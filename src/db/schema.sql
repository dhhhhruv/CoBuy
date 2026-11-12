-- ============================================================================
-- CoBuy Database Schema DDL
-- Database Engine: MySQL 8.0+ (InnoDB)
-- Owner: Dhruv (Database & Auth)
-- 
-- Normalization: Fully normalized to 3NF / BCNF.
-- All 8 tables, primary keys, foreign keys, constraints, and spatial indexes.
-- ============================================================================

-- Ensure the database exists and set the default database
CREATE DATABASE IF NOT EXISTS cobuy_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cobuy_db;

-- ----------------------------------------------------------------------------
-- Safe Teardown: Drop in reverse dependency order (children before parents)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS micro_orders;
DROP TABLE IF EXISTS buying_pools;
DROP TABLE IF EXISTS supplier_catalogue;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- 1. USERS Table
-- Stores credentials and core account information for all participants.
-- Viva Note: user_id is a UUID (CHAR(36)) instead of an auto-increment integer
-- so identifiers are globally unique and immune to sequential guessing attacks.
-- ============================================================================
CREATE TABLE users (
  user_id CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_users PRIMARY KEY (user_id),
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 2. USER_ROLES Table
-- Resolves multi-role assignments (a user can be both kitchen owner and supplier).
-- Viva Note: Storing roles here instead of a comma-separated column in USERS
-- satisfies 1NF (atomic values) and prevents update/delete anomalies.
-- Composite PK (user_id, role_name) prevents duplicate role assignments.
-- ============================================================================
CREATE TABLE user_roles (
  user_id CHAR(36) NOT NULL,
  role_name VARCHAR(20) NOT NULL,

  CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_name),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE CASCADE, -- If user is deleted, their role assignments are removed
  CONSTRAINT chk_user_roles_name CHECK (role_name IN ('restaurant_owner', 'supplier'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 3. RESTAURANTS Table
-- Stores cloud kitchen profiles.
-- Viva Note:
-- - location_coord uses POINT with SRID 4326 (standard GPS lat/long on Earth sphere).
-- - wallet_balance uses DECIMAL(10,2) to eliminate binary floating-point rounding errors.
-- ============================================================================
CREATE TABLE restaurants (
  restaurant_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  business_name VARCHAR(100) NOT NULL,
  location_coord POINT NOT NULL SRID 4326,
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  address_text TEXT NULL,

  CONSTRAINT pk_restaurants PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_restaurants_owner FOREIGN KEY (owner_id)
    REFERENCES users (user_id)
    ON DELETE RESTRICT, -- Cannot delete user if an active restaurant profile exists
  CONSTRAINT chk_restaurants_wallet CHECK (wallet_balance >= 0.00),
  SPATIAL INDEX idx_restaurants_location (location_coord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 4. SUPPLIERS Table
-- Stores supplier company profiles.
-- Viva Note:
-- - user_id links a logged-in user to their company record (Decision 2.1).
-- - warehouse_coord uses POINT with SRID 4326 and a spatial index for fast distance calculations.
-- ============================================================================
CREATE TABLE suppliers (
  supplier_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  company_name VARCHAR(100) NOT NULL,
  contact_email VARCHAR(100) NOT NULL,
  warehouse_coord POINT NOT NULL SRID 4326,

  CONSTRAINT pk_suppliers PRIMARY KEY (supplier_id),
  CONSTRAINT fk_suppliers_user FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_suppliers_email UNIQUE (contact_email),
  SPATIAL INDEX idx_suppliers_warehouse (warehouse_coord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 5. PRODUCTS Table
-- General product catalogue (independent of any specific supplier or price).
-- Viva Note: Price does NOT live here because different suppliers offer the same
-- product at different rates and MOQs. Keeping product definition separate satisfies 3NF.
-- ============================================================================
CREATE TABLE products (
  product_id CHAR(36) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL, -- e.g. 'kg', 'litre', 'crate'
  category VARCHAR(50) NULL,           -- e.g. 'Vegetables', 'Dairy', 'Dry Goods'

  CONSTRAINT pk_products PRIMARY KEY (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 6. SUPPLIER_CATALOGUE Table
-- Junction table resolving Many-to-Many between SUPPLIERS and PRODUCTS.
-- Stores supplier-specific pricing and wholesale Minimum Order Quantity (MOQ).
-- Viva Note: UNIQUE(supplier_id, product_id) allows one active offer per supplier-product
-- pair while allowing suppliers to offer many products, and products to have many suppliers.
-- ============================================================================
CREATE TABLE supplier_catalogue (
  catalogue_id CHAR(36) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  min_order_qty DECIMAL(10,2) NOT NULL,

  CONSTRAINT pk_supplier_catalogue PRIMARY KEY (catalogue_id),
  CONSTRAINT fk_catalogue_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers (supplier_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_catalogue_product FOREIGN KEY (product_id)
    REFERENCES products (product_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_catalogue_supplier_product UNIQUE (supplier_id, product_id),
  CONSTRAINT chk_catalogue_price CHECK (price_per_unit > 0.00),
  CONSTRAINT chk_catalogue_moq CHECK (min_order_qty > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 7. BUYING_POOLS Table
-- Active collective purchasing pools tied to a catalogue offer.
-- Viva Note:
-- - target_moq is snapshotted from catalogue to freeze the target at pool creation.
-- - current_qty tracks aggregate weight and is updated atomically inside transactions.
-- - geographic_zone defines the centre point for 5 km proximity checks.
-- ============================================================================
CREATE TABLE buying_pools (
  pool_id CHAR(36) NOT NULL,
  catalogue_id CHAR(36) NOT NULL,
  geographic_zone POINT NOT NULL SRID 4326,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  current_qty DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  target_moq DECIMAL(10,2) NOT NULL,
  expiration_time TIMESTAMP NOT NULL,

  CONSTRAINT pk_buying_pools PRIMARY KEY (pool_id),
  CONSTRAINT fk_pools_catalogue FOREIGN KEY (catalogue_id)
    REFERENCES supplier_catalogue (catalogue_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_pools_status CHECK (status IN ('ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT chk_pools_current_qty CHECK (current_qty >= 0.00),
  CONSTRAINT chk_pools_target_moq CHECK (target_moq > 0.00),
  SPATIAL INDEX idx_pools_zone (geographic_zone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 8. MICRO_ORDERS Table
-- Individual restaurant contributions to a buying pool.
-- Viva Note:
-- - Resolves Many-to-Many between RESTAURANTS and BUYING_POOLS.
-- - UNIQUE(pool_id, restaurant_id) enforces exactly one micro-order per kitchen per pool (Decision 2.2).
-- - pledged_amount = requested_qty * price_per_unit.
-- - payment_status tracks commitment (PENDING, PAID) without requiring an out-of-scope payment gateway.
-- ============================================================================
CREATE TABLE micro_orders (
  order_id CHAR(36) NOT NULL,
  pool_id CHAR(36) NOT NULL,
  restaurant_id CHAR(36) NOT NULL,
  requested_qty DECIMAL(10,2) NOT NULL,
  pledged_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_micro_orders PRIMARY KEY (order_id),
  CONSTRAINT fk_orders_pool FOREIGN KEY (pool_id)
    REFERENCES buying_pools (pool_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (restaurant_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_orders_pool_restaurant UNIQUE (pool_id, restaurant_id),
  CONSTRAINT chk_orders_qty CHECK (requested_qty > 0.00),
  CONSTRAINT chk_orders_pledge CHECK (pledged_amount >= 0.00),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('PENDING', 'PAID'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

