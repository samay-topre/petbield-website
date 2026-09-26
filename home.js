const scanBtn = document.getElementById("scanBtn");
const scannerModal = document.getElementById("scannerModal");
const closeScannerBtn = document.getElementById("closeScannerBtn");

let html5QrCode = null;

scanBtn.addEventListener("click", () => {
  scannerModal.classList.remove("hidden");
  startScanner();
});

closeScannerBtn.addEventListener("click", () => {
  stopScanner();
  scannerModal.classList.add("hidden");
});

function startScanner() {
  html5QrCode = new Html5Qrcode("qr-reader");

  html5QrCode
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        // Successfully scanned - extract card id and redirect to scan.html
        let cardCode = null;
        try {
          if (decodedText.includes("id=")) {
            const uri = new URL(decodedText);
            cardCode = uri.searchParams.get("id");
          } else if (decodedText.startsWith("PB")) {
            cardCode = decodedText.trim();
          }
        } catch (e) {
          cardCode = null;
        }

        if (cardCode) {
          stopScanner();
          window.location.href = `scan.html?id=${cardCode}`;
        }
      },
      () => {
        // ignore per-frame scan failures, this fires constantly while searching
      }
    )
    .catch(() => {
      alert("Unable to access camera. Please allow camera permission and try again.");
    });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
  }
}