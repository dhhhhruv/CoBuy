// ============================================================================
// File: src/client/js/components/Toast.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Lightweight toast notifications for API success and error feedback.
// ============================================================================

export function showToast(message, type = 'info', timeoutMs = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) {
    // Fallback for pages rendered outside the app shell.
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, timeoutMs);
}

export function showError(error) {
  const message = error?.message || 'Something went wrong.';
  showToast(message, 'error', 5000);
}
