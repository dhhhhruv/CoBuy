
CoBuy: Complete Project Explanation and Viva Preparation
This is the complete explanation of your CoBuy project, starting with the problem it solves and going all the way through its database design, normalization, ER diagram, DFD, relationships, constraints, and working logic.

One important distinction: I'll use the final eight-table design and the project details we've discussed. Where a design choice is an assumption rather than something already established in your implementation, I'll identify it rather than quietly pretending the database has magical capabilities.

1. Project overview
CoBuy
A B2B group-buying platform for independent cloud kitchens

Concept illustration of the cloud-kitchen environment.
CoBuy is a business-to-business (B2B) platform designed to help independent cloud kitchens purchase ingredients and supplies collectively.
The central idea is simple:
Instead of each kitchen purchasing ingredients individually, multiple kitchens located within a 5 km radius can combine their requirements to meet a supplier's minimum order quantity (MOQ).
This allows smaller kitchens to access wholesale purchasing opportunities that might otherwise require larger individual orders.
What problem are we solving?
Imagine a supplier sells tomatoes at wholesale prices but requires a minimum purchase of 500 kg.
Three independent cloud kitchens need tomatoes:
Kitchen	Required quantity
Kitchen A	200 kg
Kitchen B	150 kg
Kitchen C	150 kg
Total	500 kg
Individually, none of the kitchens can meet the 500 kg MOQ.
Together:
\[ 200+150+150=500\text{ kg} \]
They collectively meet the supplier's minimum order requirement.
CoBuy facilitates this process by allowing kitchens to discover suitable buying pools and contribute their required quantities.
The main objectives
1. Help independent kitchens access wholesale purchasing.
2. Allow nearby kitchens to combine their requirements.
3. Track the progress of collective buying pools.
4. Maintain supplier catalogues, product prices, and minimum order quantities.
5. Record individual restaurant contributions and payment statuses.
6. Reduce the difficulty of coordinating bulk purchases between multiple kitchens.
Why is this a B2B platform?
B2B stands for Business-to-Business.
CoBuy primarily connects two categories of businesses:
* Cloud kitchens: Businesses that purchase ingredients.
* Suppliers: Businesses that provide ingredients and wholesale products.
It is not primarily a consumer food-delivery platform. It facilitates procurement between businesses.

2. The people and entities involved
There are three main participants in the CoBuy ecosystem.


1. Restaurant / Cloud Kitchen Owner
* Registers on CoBuy.
* Adds restaurant information and location.
* Browses available buying pools.
* Places micro-orders.
* Tracks contributions and payment status.


2. Supplier
* Maintains company information.
* Lists available products.
* Specifies wholesale prices.
* Specifies minimum order quantities.
* Supplies products through the collective purchasing process.


3. CoBuy Platform
* Manages user accounts and roles.
* Maintains the product catalogue.
* Identifies relevant buying pools.
* Aggregates restaurant contributions.
* Tracks pool progress and order information.
Can one user be both a restaurant owner and a supplier?
Yes. Your database design allows a user to have multiple roles through the USER_ROLES table.
For example, a person could register as both a restaurant owner and a supplier.
This is why roles are maintained separately instead of storing a single role directly in the USERS table.

3. How does CoBuy actually work?
This is probably the most important section because it explains the complete project workflow.

Step 1: User registration
A kitchen owner registers on the platform.
The platform stores their:
* Username
* Email
* Password hash
* Registration timestamp
* Assigned role or roles
The user's account information is stored in USERS, while their roles are stored in USER_ROLES.
The kitchen owner then adds their restaurant details, including its name, location, and wallet balance.

Step 2: Supplier registration and product listing
A supplier registers and provides company details.
The supplier then lists products that they are willing to sell.
For each supplier-product offer, CoBuy records:
* The supplier.
* The product.
* The wholesale price per unit.
* The minimum order quantity.
For example:
Supplier	Product	Price	MOQ
Fresh Foods	Tomatoes	₹20/kg	500 kg
Fresh Foods	Onions	₹30/kg	300 kg
Green Basket	Tomatoes	₹22/kg	400 kg
Notice that the same product can be sold by multiple suppliers at different prices and MOQs.
This information is maintained in SUPPLIER_CATALOGUE.
Step 3: Finding nearby kitchens and buying pools
CoBuy uses geographical information to identify kitchens within a 5 km radius.
Your design uses geographical columns such as:
* restaurants.location_coord
* suppliers.warehouse_coord
* buying_pools.geographic_zone
The idea is to make collective purchasing possible among kitchens in a suitable geographical area.
For example, if Kitchen A is in a particular area, CoBuy can identify relevant kitchens and pools nearby.
The project discussion also included using ST_Distance_Sphere to calculate geographical distances.
A simplified conceptual query would look like:
SELECT restaurant_id
FROM restaurants
WHERE ST_Distance_Sphere(
    location_coord,
    POINT(:longitude, :latitude)
) <= 5000;
Here:
* 5000 represents 5,000 metres.
* :longitude and :latitude represent the reference location.
* The query returns restaurants within the specified distance.
The exact syntax depends on the database engine and how its spatial columns are defined.
Important: Your schema has geographical coordinates, but a complete 5 km search also needs a clearly defined reference point and a rule for which restaurants belong to a particular pool.
Step 4: Creating or joining a buying pool
A buying pool is a collective purchasing arrangement associated with a particular supplier catalogue offer.
For example:
* Product: Tomatoes
* Supplier: Fresh Foods
* Price: ₹20/kg
* Target MOQ: 500 kg
* Current quantity: 0 kg
* Status: ACTIVE
Nearby kitchens can contribute to this pool.
The buying pool stores:
* Its unique ID.
* The catalogue offer it is associated with.
* Its geographical zone.
* Its status.
* Current aggregated quantity.
* Target MOQ.
* Expiration time.
This information is stored in BUYING_POOLS.
Step 5: Placing micro-orders
When a restaurant joins a buying pool, it places a micro-order.
A micro-order represents one restaurant's contribution to a collective purchase.
For example:
Restaurant	Pool	Requested quantity
Kitchen A	BP01	200 kg
Kitchen B	BP01	150 kg
Kitchen C	BP01	150 kg
Each contribution is recorded separately in MICRO_ORDERS.
The table stores:
* Order ID.
* Pool ID.
* Restaurant ID.
* Requested quantity.
* Pledged amount.
* Payment status.
* Creation timestamp.
This allows CoBuy to identify exactly which kitchen contributed how much.

Step 6: Aggregating the quantities
Whenever a micro-order is accepted into a pool, the aggregation engine updates the pool's current quantity.
Suppose the pool has:
\[ \text{Target MOQ}=500\text{ kg} \]
The restaurants contribute:
\[ 200+150+150=500\text{ kg} \]
The pool has now reached its target.
The system can then change its status from:
ACTIVE → FULFILLED
The exact transition should be implemented through backend logic and database transactions.
What is the aggregation engine?
It is the part of the backend responsible for:
1. Receiving a restaurant's micro-order.
2. Recording the contribution.
3. Updating the pool's aggregate quantity.
4. Comparing the aggregate quantity with the target MOQ.
5. Updating the pool status when the target is reached.
For concurrent orders, the update must be transaction-safe. Otherwise, two restaurants placing orders at almost the same time could cause incorrect totals.
A database transaction helps ensure that the order insertion and pool quantity update are handled consistently.
Step 7: Payment and order tracking
Each micro-order maintains its own payment status.
For example:
Restaurant	Pledged amount	Payment status
Kitchen A	₹4,000	PAID
Kitchen B	₹3,000	PAID
Kitchen C	₹3,000	PENDING
The platform can track which restaurants have paid and which have not.
The schema records pledged amounts and payment statuses, but a full payment gateway, refund workflow, and supplier payout process would require additional implementation beyond the eight tables currently shown.

4. Technology stack
Your proposed technology stack is:
Layer	Technology
Backend runtime	Node.js
Backend framework	Express.js
Programming language	JavaScript
Database	MySQL or PostgreSQL
Frontend	React or HTML, CSS, JavaScript
What does each technology do?
Node.js
Node.js allows JavaScript to run on the server side. It handles backend operations such as processing requests, executing business logic, and communicating with the database.
Express.js
Express is a backend web framework for Node.js.
It helps create API endpoints and handle HTTP requests.
For example:
POST /api/users/register
GET  /api/products
GET  /api/pools
POST /api/orders
JavaScript
JavaScript is used to implement application logic.
MySQL / PostgreSQL
The relational database stores the application's structured information.
It maintains relationships using primary keys, foreign keys, and other integrity constraints.
React / HTML / CSS / JavaScript
The frontend provides the interface through which restaurant owners and suppliers interact with CoBuy.

5. Database design: the eight tables
Your final database contains eight relations.
Before examining them individually, remember this distinction:
* A table stores information about a particular entity or relationship.
* A row represents one record.
* A column represents one attribute.
* A primary key uniquely identifies a row.
* A foreign key connects a row to another table.
Table 1: USERS
Main user entity
Column	Data type	Constraint
user_id	UUID	PK, NOT NULL
username	VARCHAR	UK, NOT NULL
email	VARCHAR	UK, NOT NULL
password_hash	VARCHAR	NOT NULL
created_at	TIMESTAMP	NOT NULL
Purpose
Stores the account information of people registered on CoBuy.

Why do we use user_id as the primary key?

Username and email can both uniquely identify a user, but they are user-facing values that may change.
A system-generated ID is more suitable as a stable internal identifier.
Other tables can reference user_id without needing to know the user's email or username.

Why are username and email unique?
To prevent duplicate usernames and duplicate email registrations.

Table 2: USER_ROLES
Role mapping table
Column	Data type	Constraint
user_id	UUID	PK, FK, NOT NULL
role_name	VARCHAR	PK, NOT NULL
Purpose
Stores the roles assigned to users.
For example:
user_id	role_name
U01	restaurant_owner
U01	supplier
U02	restaurant_owner
Why a separate table?
One user can have multiple roles.
Storing multiple roles in a single field would create a repeating group and make the data harder to query.
Why a composite primary key?
The combination (user_id, role_name) must be unique.
It prevents the same role from being assigned to the same user twice.
user_id is also a foreign key referencing USERS.user_id.

Table 3: RESTAURANTS
Kitchen information
Column	Data type	Constraint
restaurant_id	UUID	PK, NOT NULL
owner_id	UUID	FK, NOT NULL
business_name	VARCHAR	NOT NULL
location_coord	GEOMETRY	NOT NULL
wallet_balance	DECIMAL	NOT NULL
address_text	TEXT	NULLABLE
Purpose
Stores the information about individual cloud kitchens registered on CoBuy.
Why does it contain owner_id?
To identify the user who owns the restaurant.
It references USERS.user_id.
One user can own multiple restaurants, but each restaurant record has one owner in this design.
Why geographical coordinates?
They are required for identifying nearby restaurants and supporting location-based pool discovery.
Why wallet balance?
It represents the restaurant's wallet balance in the proposed design.
A real implementation would also need a transaction history to properly audit wallet deposits, deductions, and refunds.

Table 4: SUPPLIERS
Supplier information
Column	Data type	Constraint
supplier_id	UUID	PK, NOT NULL
company_name	VARCHAR	NOT NULL
contact_email	VARCHAR	UK, NOT NULL
warehouse_coord	GEOMETRY	NOT NULL
Purpose
Stores information about suppliers participating in CoBuy.
Why do we keep suppliers separate from products?
Because a supplier can sell many products, and a product can be sold by multiple suppliers.
Keeping supplier information in a separate table avoids repeating the company's contact details for every product offer.

Table 5: PRODUCTS
Product information
Column	Data type	Constraint
product_id	UUID	PK, NOT NULL
product_name	VARCHAR	NOT NULL
unit_of_measure	VARCHAR	NOT NULL
category	VARCHAR	NULLABLE
Purpose
Stores general information about products available through CoBuy.
For example:
product_id	product_name	unit_of_measure
P01	Tomatoes	kg
P02	Onions	kg
P03	Cooking Oil	litre
Why is price not stored here?
Because the same product can have different prices depending on the supplier.
Tomatoes from Fresh Foods may cost ₹20/kg, while tomatoes from Green Basket may cost ₹22/kg.
Therefore, price belongs to the supplier's specific product offer, not to the general product definition.

Table 6: SUPPLIER_CATALOGUE
Supplier-product junction table
Column	Data type	Constraint
catalogue_id	UUID	PK, NOT NULL
supplier_id	UUID	FK, NOT NULL
product_id	UUID	FK, NOT NULL
price_per_unit	DECIMAL	NOT NULL
min_order_qty	DECIMAL	NOT NULL
Additional constraint:
UNIQUE(supplier_id, product_id)
Purpose
Stores the specific products offered by suppliers, along with their prices and MOQs.
For example:
catalogue_id	supplier_id	product_id	price	MOQ
C01	S01	P01	₹20/kg	500 kg
C02	S01	P02	₹30/kg	300 kg
C03	S02	P01	₹22/kg	400 kg
Why do we need this table?
Because the relationship between suppliers and products is many-to-many.
A supplier can sell multiple products, and the same product can be sold by multiple suppliers.
We resolve that many-to-many relationship through SUPPLIER_CATALOGUE.
Why is the composite unique constraint necessary?
We don't want the same supplier-product combination to be entered more than once if the design allows only one offer per product from each supplier.
However, we must not make supplier_id or product_id individually unique.
Doing so would prevent suppliers from offering multiple products and products from being offered by multiple suppliers.

Table 7: BUYING_POOLS
Collective purchasing entity
Column	Data type	Constraint
pool_id	UUID	PK, NOT NULL
catalogue_id	UUID	FK, NOT NULL
geographic_zone	GEOMETRY	NOT NULL
status	VARCHAR	NOT NULL
current_qty	DECIMAL	NOT NULL
target_moq	DECIMAL	NOT NULL
expiration_time	TIMESTAMP	NOT NULL
Purpose
Stores information about collective purchasing pools.
A buying pool is associated with one particular supplier catalogue offer.
For example:
pool_id	catalogue_id	current_qty	target_moq	status
BP01	C01	350 kg	500 kg	ACTIVE
BP02	C02	200 kg	300 kg	ACTIVE
Why does it contain catalogue_id?
Because the pool needs to know which supplier-product offer it is collecting orders for.
This lets the platform identify the relevant supplier, product, price, and MOQ through the catalogue record.
Why does it contain current_qty?
To track the total quantity contributed by all participating restaurants.
Why does it contain target_moq?
To identify the quantity the pool must reach before it can be marked as fulfilled.
Why does it contain status?
To track the pool's lifecycle.
Possible values include:
* ACTIVE
* FULFILLED
* EXPIRED
* CANCELLED
These are suggested allowed values; your actual implementation should define which states it supports.

Table 8: MICRO_ORDERS
Restaurant contribution records
Column	Data type	Constraint
order_id	UUID	PK, NOT NULL
pool_id	UUID	FK, NOT NULL
restaurant_id	UUID	FK, NOT NULL
requested_qty	DECIMAL	NOT NULL
pledged_amount	DECIMAL	NOT NULL
payment_status	VARCHAR	NOT NULL
created_at	TIMESTAMP	NOT NULL
Purpose
Stores individual restaurant contributions to buying pools.
For example:
order_id	pool_id	restaurant_id	quantity
O01	BP01	R01	200 kg
O02	BP01	R02	150 kg
O03	BP01	R03	150 kg
Why does it reference both pool_id and restaurant_id?
Because CoBuy needs to know:
1. Which pool the restaurant is contributing to.
2. Which restaurant made the contribution.
A micro-order represents one restaurant's participation in one pool.
This table also resolves the many-to-many relationship between restaurants and buying pools.

6. Complete relationship explanation
This is the complete relationship structure in your ER diagram.
Parent	Child	Relationship	Reason
USERS	USER_ROLES	1:N	A user can have multiple roles.
USERS	RESTAURANTS	1:N	A user can own multiple restaurants.
SUPPLIERS	SUPPLIER_CATALOGUE	1:N	A supplier can offer multiple products.
PRODUCTS	SUPPLIER_CATALOGUE	1:N	A product can be offered by multiple suppliers.
SUPPLIER_CATALOGUE	BUYING_POOLS	1:N	One offer can be used by multiple pools.
BUYING_POOLS	MICRO_ORDERS	1:N	A pool can contain multiple micro-orders.
RESTAURANTS	MICRO_ORDERS	1:N	A restaurant can place multiple micro-orders.
Why is a junction table necessary?
There are two many-to-many relationships in your design.
Suppliers and products
One supplier sells multiple products, and one product can be sold by multiple suppliers.
Resolved through SUPPLIER_CATALOGUE.
Restaurants and buying pools
One restaurant can participate in multiple pools, and one pool can have multiple restaurants.
Resolved through MICRO_ORDERS.
The junction tables convert many-to-many relationships into two one-to-many relationships.
What does the notation mean?
* 1 means one parent record.
* N means many child records.
* PK means primary key.
* FK means foreign key.
* UK means unique key.
A foreign key is placed in the child table because each child record needs to identify its parent.
For example, MICRO_ORDERS.pool_id references BUYING_POOLS.pool_id.

7. Normalization: how we reached the eight-table design
Normalization is the process of organizing data into relations to reduce unnecessary duplication and prevent insertion, update, and deletion anomalies.
Your project follows the progression:
Normalization journey
UNF
1NF
2NF
3NF
BCNF
4NF: Final design verification
BCNF is stricter than 3NF; 4NF addresses multivalued dependencies.
UNF: Unnormalized Form
Initially, imagine a giant COBUY_MASTER table containing:
* User information.
* User roles.
* Restaurant details.
* Supplier information.
* Products.
* Catalogue offers.
* Buying pools.
* Micro-orders.
Some fields contain multiple values, such as:
user_roles = restaurant_owner, supplier
Or:
micro_orders = O01, O02, O03
This creates repeating groups and makes the data difficult to maintain.
1NF: First Normal Form
Rule: Every attribute must contain atomic values, and repeating groups must be removed.
Instead of:
user_id	roles
U01	restaurant_owner, supplier
We create separate rows:
user_id	role_name
U01	restaurant_owner
U01	supplier
Every cell contains one value.
2NF: Second Normal Form
Rule: The relation must be in 1NF, and every non-prime attribute must be fully functionally dependent on every candidate key.
This removes partial dependencies.
For example, suppose a flattened relation has the composite key:
(order_id, product_id)
If product_name depends only on product_id, it is a partial dependency.
It should be stored in PRODUCTS, not repeated in the order relation.
The result is a more organized collection of entity-specific relations.
3NF: Third Normal Form
Rule: The relation must be in 2NF, and for each non-trivial functional dependency \(X \rightarrow A\), either \(X\) must be a superkey or \(A\) must be a prime attribute.
In simpler terms, this removes inappropriate transitive dependencies.
In CoBuy:
* Product information belongs in PRODUCTS.
* Supplier information belongs in SUPPLIERS.
* Supplier-specific prices and MOQs belong in SUPPLIER_CATALOGUE.
This avoids repeating product and supplier details in multiple places.
BCNF: Boyce-Codd Normal Form
Rule: Every determinant of a non-trivial functional dependency must be a superkey.
A determinant is the attribute or set of attributes on the left side of a functional dependency.
For example:
\[ user\_id \rightarrow username,email,password\_hash \]
user_id is a primary key and therefore a superkey.
We examine the functional dependencies of each relation to check that this condition holds.
4NF: Fourth Normal Form
Rule: A relation must be in BCNF and must not contain non-trivial multivalued dependencies unless their determinants are superkeys.
This addresses independent sets of multiple values.
For example, a user might independently have:
* Multiple roles.
* Multiple preferred languages.
Combining both in a single relation could create unnecessary combinations.
Separating role assignments into USER_ROLES avoids that particular kind of mixing.
A technical caution for your viva: Having a USER_ROLES table does not automatically prove that the original relation violated 4NF. A formal 4NF decomposition requires identifying the actual independent multivalued dependencies. Explain the purpose of the table, but don't claim that the table's existence alone proves 4NF.
Why do we normalize?
Three common database anomalies explain the need for normalization.
Anomaly	Meaning	CoBuy example
Insertion anomaly	Difficulty inserting information without unrelated information	A supplier cannot be listed independently if the only place to store suppliers is an order table.
Update anomaly	The same information must be changed in multiple places	A supplier's email is repeated across many order records.
Deletion anomaly	Deleting one record accidentally removes other useful information	Deleting the last order could accidentally remove the only stored record of a supplier.
The goal is to store each kind of fact in an appropriate relation and connect the relations through keys.

8. ER diagram versus DFD
These are different diagrams that describe different aspects of your project.
This is a very likely viva topic.
ER diagram
ER stands for Entity-Relationship.
It describes the structure of the database.
It tells us:
* What entities exist.
* What attributes they contain.
* Which attributes are primary keys.
* Which attributes are foreign keys.
* How entities are related.
For CoBuy, the ER diagram contains eight entities:
USERS, USER_ROLES, RESTAURANTS, SUPPLIERS, PRODUCTS, SUPPLIER_CATALOGUE, BUYING_POOLS, and MICRO_ORDERS.
It is concerned with how the data is organized and connected.
DFD
DFD stands for Data Flow Diagram.
It describes how information moves through the system.
It shows:
* External entities.
* Processes.
* Data stores.
* Data flows.
It is concerned with how the application receives, processes, stores, and returns information.
The easiest way to remember
ER diagram	DFD
Database structure	Information movement
Entities and relationships	Processes and data flows
PKs and FKs	Inputs and outputs
Static representation	Process-oriented representation
A simple viva answer:
"An ER diagram represents the logical structure of the database, showing entities, attributes, keys, and relationships. A DFD represents the movement of data through the system, showing external entities, processes, data stores, and data flows."

9. CoBuy DFD: Level 0
Your Level 0 DFD represents CoBuy as one central process.
There are two main external entities.
Kitchen Owner
Sends information to CoBuy:
* Registration details.
* Restaurant details.
* Location.
* Micro-order requests.
Receives information from CoBuy:
* Available buying pools.
* Pool progress.
* Order information.
* Receipts or invoices.
Supplier
Sends information to CoBuy:
* Product listings.
* Prices.
* Minimum order quantities.
* Supplier information.
Receives information from CoBuy:
* Consolidated bulk-order information.
* Relevant purchasing information.
* Payout information, if that functionality is implemented.
CoBuy as the central process
The entire platform is represented as a single process.
Level 0 intentionally does not show every internal operation.
It provides a high-level view of the system and its interaction with external entities.

10. CoBuy DFD: Level 1
Level 1 breaks the central CoBuy process into smaller processes.
Your design has four main processes.
Level 1 processes
1.0 Authentication & Profile Management
Handles registration, login, user roles, and restaurant/supplier profiles.
Data stores: USERS, USER_ROLES, RESTAURANTS, SUPPLIERS
2.0 Catalogue Management
Manages products, suppliers, supplier offers, prices, and MOQs.
Data stores: PRODUCTS, SUPPLIERS, SUPPLIER_CATALOGUE
3.0 Pool Discovery
Identifies relevant buying pools and supports location-based discovery.
Data stores: BUYING_POOLS, RESTAURANTS, SUPPLIER_CATALOGUE
4.0 Aggregation Engine
Records micro-orders, aggregates quantities, checks target MOQ, and updates pool status.
Data stores: MICRO_ORDERS, BUYING_POOLS
Process 1.0: Authentication and Profile Management
A user sends registration information.
The system validates the details and stores the user account.
The system also manages assigned roles and the user's restaurant or supplier profile.
Process 2.0: Catalogue Management
The supplier provides product information, wholesale prices, and MOQs.
The platform stores the general product information and the supplier-specific offers.
This process makes the products available for pool creation or discovery.
Process 3.0: Pool Discovery
The platform uses location information to identify relevant pools.
The system considers geographical proximity and the catalogue offer associated with each pool.
The user can then discover pools that match their purchasing requirements.
Process 4.0: Aggregation Engine
The restaurant submits a micro-order.
The system records the requested quantity and updates the pool's current quantity.
The system compares the aggregated quantity with the target MOQ.
If the target is reached, the pool can be marked as fulfilled.
Why do we need both Level 0 and Level 1?
Level 0 explains what enters and leaves the system.
Level 1 explains how the system processes that information internally.

11. Important database constraints
Constraints are rules applied to the database to maintain data integrity.
Your project uses several kinds.
Constraint	Meaning	CoBuy example
Primary Key	Uniquely identifies each record	USERS.user_id
Foreign Key	References another table's key	RESTAURANTS.owner_id
Unique	Prevents duplicate values	USERS.email
Not Null	Requires a value	PRODUCTS.product_name
Composite Primary Key	Uses multiple columns together	USER_ROLES(user_id, role_name)
Composite Unique	Prevents duplicate combinations	SUPPLIER_CATALOGUE(supplier_id, product_id)
Check	Restricts permitted values	requested_qty > 0
Why not use email as the primary key?
Email could technically be a primary key because it is unique.
However, we use user_id because it is a stable internal identifier.
If a user changes their email address, their user_id remains unchanged.
Why not use username as the primary key?
The same principle applies.
Usernames can be changed, but the internal user ID is intended to remain stable.
Username and email are therefore unique alternate keys, while user_id is the primary key.
Why is supplier_id not unique in SUPPLIER_CATALOGUE?
Because one supplier can offer multiple products.
If supplier_id were individually unique in the catalogue table, a supplier could have only one catalogue entry.
Why is product_id not unique in SUPPLIER_CATALOGUE?
Because the same product can be offered by multiple suppliers.
Instead, we use a composite unique constraint on:
\[ (supplier\_id,product\_id) \]
This prevents duplicate supplier-product pairs while allowing both suppliers and products to appear in multiple catalogue records.

12. Team division of work
Based on the division of responsibilities you previously described, your team has three main development roles.
Developer	Responsibility	Main work
Dev 1	Database and Authentication	Database setup, authentication APIs, CRUD operations
Dev 2	Aggregation Engine	Micro-order handling, atomic transactions, quantity aggregation, pool status and cost logic
Dev 3	Frontend	Dashboards, user interface, pool progress bars and user interactions
Dev 1: Database and Authentication
Responsible for:
* Creating the database tables.
* Defining primary and foreign keys.
* Implementing registration and login.
* Managing user roles.
* Implementing CRUD APIs.
CRUD stands for:
* Create
* Read
* Update
* Delete
Dev 2: Aggregation Engine
Responsible for the main purchasing logic.
The aggregation engine must:
* Accept micro-orders.
* Update current pool quantities.
* Check the MOQ.
* Change pool status when appropriate.
* Use transactions to prevent inconsistent concurrent updates.
Dev 3: Frontend
Responsible for the user-facing interface.
Examples:
* Restaurant dashboards.
* Supplier dashboards.
* Available buying pools.
* Quantity progress bars.
* Order information.
* Payment status displays.

13. Important technical decisions and limitations
These are details an examiner might ask about if they want to go beyond definitions.
1. Why use UUIDs?
UUID stands for Universally Unique Identifier.
Your design uses UUIDs for primary keys.
Advantages:
* They are designed to be unique across systems.
* They do not require sequential ID allocation.
* They are useful when records may be created across multiple services.
A disadvantage is that UUIDs are larger than simple integer IDs and can have performance/storage implications depending on the database and indexing strategy.
2. Why use DECIMAL for money?
Money should generally be stored using a fixed-precision numeric type such as DECIMAL, rather than floating-point types.
Floating-point arithmetic can introduce precision errors.
For example, monetary values should not unexpectedly produce results like ₹99.999999 when the intended amount is ₹100.
3. Why use GEOMETRY?
The GEOMETRY type can represent spatial information.
CoBuy needs geographical data to identify nearby kitchens and support location-based discovery.
For a real implementation, the database must use a consistent spatial reference system and appropriate spatial indexes where supported.
4. Why use transactions in the aggregation engine?
Imagine two kitchens place orders at almost exactly the same time.
The pool currently has 350 kg, and its target is 500 kg.
Both kitchens submit 100 kg.
If both requests read the old quantity of 350 kg and then independently update it to 450 kg, one contribution could effectively disappear from the aggregate.
This is a concurrency problem.
Transactions and appropriate locking or atomic updates help ensure that both contributions are accounted for correctly.
5. Does reaching the MOQ automatically mean the supplier has accepted the order?
No.
Reaching the MOQ means the pool has collected enough quantity to satisfy the target.
It does not automatically prove that the supplier has received, accepted, or dispatched the order.
A production implementation would need additional order-submission and supplier-confirmation states.
6. Does the current schema handle refunds?
Not explicitly.
payment_status can represent payment states, but a complete refund system would benefit from a separate payment transaction or refund table.
7. Does the current schema support multiple prices from the same supplier for the same product?
Not under the proposed composite unique constraint.
UNIQUE(supplier_id, product_id) assumes one active offer per supplier-product pair.
If the business later requires multiple packaging sizes, grades, or price tiers, the catalogue design would need additional attributes or a different uniqueness rule.

8. The entire project in one explanation
If your examiner asks you to explain the project from beginning to end, this is the answer you should be able to give:
CoBuy: Project Explanation
CoBuy is a B2B group-buying platform designed for independent cloud kitchens. The main problem it addresses is that individual kitchens may not purchase enough quantity to meet the minimum order quantities required by wholesale suppliers.
CoBuy solves this by allowing nearby kitchens, particularly those within a 5 km radius, to combine their purchasing requirements and collectively meet the supplier's minimum order quantity.
The platform has two main business participants: restaurant owners and suppliers. Restaurant owners register their kitchens, provide location information, discover nearby buying pools, and place micro-orders. Suppliers register their companies, list products, and specify wholesale prices and minimum order quantities.
The database consists of eight tables: USERS, USER_ROLES, RESTAURANTS, SUPPLIERS, PRODUCTS, SUPPLIER_CATALOGUE, BUYING_POOLS, and MICRO_ORDERS.
USERS stores account information, while USER_ROLES maintains the roles assigned to each user. RESTAURANTS stores kitchen details and references the user who owns each restaurant. SUPPLIERS stores supplier information, and PRODUCTS stores general product details.
SUPPLIER_CATALOGUE connects suppliers and products through a many-to-many relationship. It also stores supplier-specific prices and minimum order quantities. BUYING_POOLS stores the collective purchasing pools associated with catalogue offers, including their geographical zones, target quantities, current quantities, statuses, and expiration times. MICRO_ORDERS records the individual contributions made by restaurants to those pools.
The database uses primary keys to uniquely identify records and foreign keys to establish relationships between tables. Composite keys and unique constraints prevent duplicate records where necessary.
The database was designed using normalization principles, progressing from an unnormalized structure through 1NF, 2NF, 3NF, BCNF, and 4NF considerations. The purpose is to reduce redundancy, maintain data integrity, and organize information into appropriate relations.
The system's Data Flow Diagram consists of a Level 0 representation, where CoBuy is shown as one central process interacting with kitchen owners and suppliers, and a Level 1 representation, which divides the platform into Authentication and Profile Management, Catalogue Management, Pool Discovery, and the Aggregation Engine.
The aggregation engine is responsible for recording micro-orders, updating the total quantity in a buying pool, comparing it with the target MOQ, and updating the pool's status when the target is reached. Database transactions are important to ensure that simultaneous orders do not produce incorrect aggregate quantities.
The proposed technology stack consists of Node.js and Express.js for the backend, JavaScript for application logic, MySQL or PostgreSQL for the relational database, and React or HTML, CSS, and JavaScript for the frontend.
Overall, CoBuy aims to simplify wholesale procurement for independent cloud kitchens by enabling collective purchasing, tracking individual contributions, and managing supplier-specific purchasing requirements through a structured relational database.

9. What you should understand rather than memorize
If you have limited revision time, prioritize these concepts:
Your final revision priorities
Highest priority
Project workflow
Understand how a supplier creates an offer, how a pool is created, how kitchens contribute, and how the MOQ is reached.

All eight tables
Know what each table stores, why it exists, and why its primary and foreign keys are designed as they are.

Seven relationships
Be able to explain why each is 1:N and how the two junction tables resolve many-to-many relationships.

Normalization
Know the rule for each normal form and one example from CoBuy.

ER diagram versus DFD
Understand the difference between database structure and data movement.

Constraints and transactions
Know why we use primary keys, foreign keys, unique constraints, check constraints, and transactions.
One final thing: Don't claim that every feature is fully implemented just because it appears in the proposed design. In particular, your current eight tables do not explicitly model payment transactions, supplier order confirmation, delivery tracking, or refunds. If asked, explain those as possible extensions rather than inventing functionality.
The most important thing to understand about CoBuy is that it is not merely a collection of eight database tables. Every table exists to support one part of the same business process:
A supplier offers a product → kitchens discover a suitable pool → restaurants contribute micro-orders → CoBuy aggregates the quantities → the collective order reaches the supplier's MOQ.
If you can explain that process and justify the database design supporting it, you understand the project rather than merely remembering its diagram.

