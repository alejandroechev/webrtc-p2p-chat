let localStream, remoteStream, peerConnection, dataChannel;
const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const signalingServer = new WebSocket("ws://localhost:8080");
signalingServer.onmessage = async (event) => {
    // Check if the received data is a Blob
    if (event.data instanceof Blob) {
        // Convert the Blob to a string
        message = await event.data.text();
    } else {
        // Assume it's already a string
        message = event.data;
    }
    const data = JSON.parse(message);
    console.log(data);

    if (data.offer) await handleRemoteDescription(data.offer);
    else if (data.answer) await handleRemoteDescription(data.answer);
    else if (data.candidate) handleIceCandidate(data.candidate);
};

// HTML Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const muteButton = document.getElementById("muteButton");
const hideVideoButton = document.getElementById("hideVideoButton");
const startCallButton = document.getElementById("startCallButton");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const logBox = document.getElementById("log-box");

// Utility Functions
function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  logBox.textContent += `[${timestamp}] ${message}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

// Initialize Media
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    logEvent("Local media stream initialized.");
  } catch (error) {
    logEvent(`Error initializing media: ${error.message}`);
  }
}

// Create Peer Connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  if (localStream)
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signalingServer.send(JSON.stringify({ candidate: event.candidate }));
    }
  };

  peerConnection.onconnectionstatechange = () => {
    logEvent(`Connection state changed: ${peerConnection.connectionState}`);
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };
}

// Setup Data Channel
function setupDataChannel() {
  dataChannel.onopen = () => logEvent("Data channel opened.");
  dataChannel.onmessage = (event) => {
    const message = `Peer: ${event.data}`;
    displayChatMessage(message);
  };
}

// Start Call
async function startCall() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify({ offer }));
  logEvent("Offer sent.");
}

function initWebRTC() {
    createPeerConnection();
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannel();
}

// Handle Remote SDP
async function handleRemoteDescription(description) {
  await peerConnection.setRemoteDescription(description);
  logEvent("Remote description set.");

  if (description.type === "offer") {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ answer }));
    logEvent("Answer sent.");
  }
}

// Handle ICE Candidate
function handleIceCandidate(candidate) {
  peerConnection.addIceCandidate(candidate).catch(error => {
    logEvent(`Error adding ICE candidate: ${error.message}`);
  });
}

// Mute/Unmute Audio
muteButton.addEventListener("click", () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  muteButton.textContent = audioTrack.enabled ? "Mute" : "Unmute";
  logEvent(`Audio ${audioTrack.enabled ? "unmuted" : "muted"}.`);
});

// Hide/Show Video
hideVideoButton.addEventListener("click", () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  hideVideoButton.textContent = videoTrack.enabled ? "Hide Video" : "Show Video";
  logEvent(`Video ${videoTrack.enabled ? "shown" : "hidden"}.`);
});

// Send Chat Message
sendButton.addEventListener("click", () => {
  const message = chatInput.value;
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(message);
    displayChatMessage(`You: ${message}`);
    chatInput.value = "";
  }
});

// Display Chat Message
function displayChatMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Initialize
document.body.onload = async () =>
{
    await initMedia();
    initWebRTC();
    startCallButton.addEventListener("click", startCall);
}

