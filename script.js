// ====== SUPABASE SETUP ======
const SUPABASE_URL = "https://wkhlecvfygujdxokqoln.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4p9Ng4ST9gaIqUkFKlwryw_iaXrdK3E";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== GET CARD CODE FROM THE URL ======
const urlParams = new URLSearchParams(window.location.search);
const cardCode = urlParams.get("id");

// ====== DOM ELEMENTS ======
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const mainContent = document.getElementById("mainContent");
const petNameEl = document.getElementById("petName");
const specialInstructionsEl = document.getElementById("specialInstructions");
const dropoffSection = document.getElementById("dropoffSection");
const dropoffAddress = document.getElementById("dropoffAddress");
const dropoffMapLink = document.getElementById("dropoffMapLink");
const locationBtn = document.getElementById("locationBtn");
const locationStatus = document.getElementById("locationStatus");

const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const restartBtn = document.getElementById("restartBtn");
const audioPreview = document.getElementById("audioPreview");

const sendBtn = document.getElementById("sendBtn");
const sendStatus = document.getElementById("sendStatus");

const thankYouState = document.getElementById("thankYouState");
const thankYouPetName = document.getElementById("thankYouPetName");
const sendAnotherBtn = document.getElementById("sendAnotherBtn");

// ====== STATE VARIABLES ======
let capturedLat = null;
let capturedLng = null;
let audioBlob = null;
let mediaRecorder = null;
let audioChunks = [];

// ====== SHOW A GENERIC ERROR (never show technical details to user) ======
function showError(message) {
  loadingState.classList.add("hidden");
  mainContent.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorMessage.textContent = message || "Unknown error occurred. Please try again.";
}

// ====== LOAD CARD INFO ON PAGE LOAD ======
async function loadCardInfo() {
  if (!cardCode) {
    showError("Invalid link. No card code found.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("get_card_info", {
      p_card_code: cardCode,
    });

    if (error || !data || data.length === 0) {
      showError("This card is not recognized. Please check the QR code.");
      return;
    }

    const card = data[0];

    if (card.status !== "active") {
      showError("This card has not been activated yet by its owner.");
      return;
    }

    petNameEl.textContent = card.pet_name || "this pet";
    specialInstructionsEl.textContent =
      card.special_instructions && card.special_instructions.trim() !== ""
        ? card.special_instructions
        : "No special instructions provided.";

    // Show drop-off address + Google Maps link, if owner set a location
         if (card.owner_latitude && card.owner_longitude) {
      dropoffSection.classList.remove("hidden");
      dropoffAddress.textContent =
        card.owner_address && card.owner_address.trim() !== ""
          ? card.owner_address
          : "No address text provided, use the map link below.";
      dropoffMapLink.href = `https://www.google.com/maps?q=${card.owner_latitude},${card.owner_longitude}`;
    }

    loadingState.classList.add("hidden");
    mainContent.classList.remove("hidden");
  } catch (err) {
    showError("Unknown error occurred. Please try again.");
  }
}

loadCardInfo();

// ====== LOCATION CAPTURE ======
locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Location is not supported on this device.";
    return;
  }

  locationStatus.textContent = "Requesting location access...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedLat = position.coords.latitude;
      capturedLng = position.coords.longitude;
      locationStatus.textContent = "✅ Location captured successfully!";
      locationBtn.textContent = "📍 Location Shared";
    },
    (err) => {
      locationStatus.textContent = "Location access denied or unavailable.";
    }
  );
});

// ====== VOICE RECORDING ======
recordBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioPreview.src = audioUrl;
      audioPreview.classList.remove("hidden");
      restartBtn.classList.remove("hidden");
    };

    mediaRecorder.start();
    recordBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
  } catch (err) {
    locationStatus.textContent = "";
    alert("Microphone access denied or unavailable.");
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
  }
  stopBtn.classList.add("hidden");
  recordBtn.classList.add("hidden"); // hide "Start Recording" too, only show preview + re-record
});

restartBtn.addEventListener("click", () => {
  audioBlob = null;
  audioPreview.classList.add("hidden");
  restartBtn.classList.add("hidden");
  audioPreview.src = "";
  recordBtn.classList.remove("hidden"); // bring back "Start Recording" so they can record fresh
  recordBtn.textContent = "🎙️ Start Recording";
});

// ====== SEND BUTTON ======
sendBtn.addEventListener("click", async () => {
  if (capturedLat === null || capturedLng === null) {
    sendStatus.textContent = "⚠️ Please share your location before sending.";
    return;
  }

  sendBtn.disabled = true;
  sendStatus.textContent = "Sending...";

  try {
    let voiceUrl = null;

    if (audioBlob) {
      const fileName = `${cardCode}_${Date.now()}.webm`;

      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("voice-messages")
        .upload(fileName, audioBlob);

      if (uploadError) {
        showFailure();
        return;
      }

      const { data: publicUrlData } = supabaseClient.storage
        .from("voice-messages")
        .getPublicUrl(fileName);

      voiceUrl = publicUrlData.publicUrl;
    }

    const { error: submitError } = await supabaseClient.rpc("submit_scan", {
      p_card_code: cardCode,
      p_latitude: capturedLat,
      p_longitude: capturedLng,
      p_voice_url: voiceUrl,
    });

    if (submitError) {
      showFailure();
      return;
    }

    // Show the Thank You screen instead of just a status message
    thankYouPetName.textContent = petNameEl.textContent;
    mainContent.classList.add("hidden");
    thankYouState.classList.remove("hidden");
  } catch (err) {
    showFailure();
  }
});

function showFailure() {
  sendStatus.textContent = "Unknown error occurred. Please try again.";
  sendBtn.disabled = false;
}

// ====== SEND ANOTHER UPDATE (reload page fresh, like rescanning) ======
sendAnotherBtn.addEventListener("click", () => {
  window.location.reload();
});