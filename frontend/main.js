import fullpage from "fullpage.js/dist/fullpage.extensions.min.js";
import "fullpage.js/dist/fullpage.min.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths issue with bundlers
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconUrl: icon,
	iconRetinaUrl: iconRetina,
	shadowUrl: iconShadow
});

// Get invite parameter from URL
const urlParams = new URLSearchParams(window.location.search);
const inviteSlug = urlParams.get("invite");

document.getElementById("invitationContent").style.display = "block";

// Checkbox mutual exclusion (radio button behavior)
const comeYesCheckbox = document.getElementById("come-yes");
const comeNoCheckbox = document.getElementById("come-no");

if (comeYesCheckbox && comeNoCheckbox) {
	comeYesCheckbox.addEventListener("change", function () {
		if (this.checked) {
			comeNoCheckbox.checked = false;
		}
	});

	comeNoCheckbox.addEventListener("change", function () {
		if (this.checked) {
			comeYesCheckbox.checked = false;
		}
	});
}

// Load existing RSVP if available
const loadExistingRSVP = async () => {
	if (!inviteSlug) return;

	try {
		const response = await fetch(`/api/rsvp/${inviteSlug}`);
		if (response.ok) {
			const rsvp = await response.json();
			if (rsvp.response === "yes") {
				comeYesCheckbox.checked = true;
			} else if (rsvp.response === "no") {
				comeNoCheckbox.checked = true;
			}
		}
	} catch (error) {
		console.log("No existing RSVP found");
	}
};

// Handle form submission
const submitBtn = document.getElementById("submitBtn");
const statusDiv = document.getElementById("submitStatus");

if (submitBtn) {
	submitBtn.addEventListener("click", async function () {
		if (!inviteSlug) {
			statusDiv.textContent = "無效的邀請連結";
			statusDiv.style.color = "#ff4444";
			return;
		}

		const response = comeYesCheckbox.checked ? "yes" : comeNoCheckbox.checked ? "no" : null;

		if (!response) {
			statusDiv.textContent = "請選擇一個選項";
			statusDiv.style.color = "#ff4444";
			return;
		}

		// Show submitting message
		statusDiv.textContent = "送出中...";
		statusDiv.style.color = "#666";
		submitBtn.disabled = true;

		try {
			const submitResponse = await fetch("/api/rsvp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					slug: inviteSlug,
					response: response
				})
			});

			if (submitResponse.ok) {
				// Show success message based on response
				if (response === "yes") {
					statusDiv.textContent = "期待當天與您相遇";
					statusDiv.style.color = "#4CAF50";
				} else {
					statusDiv.textContent = "真可惜 展期若有空都歡迎前來觀展";
					statusDiv.style.color = "#ff69b4";
				}
			} else {
				statusDiv.textContent = "送出失敗，請稍後再試";
				statusDiv.style.color = "#ff4444";
			}
		} catch (error) {
			statusDiv.textContent = "送出失敗，請稍後再試";
			statusDiv.style.color = "#ff4444";
		} finally {
			submitBtn.disabled = false;
		}
	});
}

const loadInvitation = async () => {
	const loading = document.getElementById("loading");
	const content = document.querySelector("main");

	if (!inviteSlug) {
		// No invite slug, show default content
		loading.style.display = "none";
		content.style.display = "block";
		return;
	}

	try {
		const response = await fetch(`/api/invitation/${inviteSlug}`);

		if (response.ok) {
			const invitation = await response.json();

			// Update page title
			document.title = `Invitation for ${invitation.name}`;

			// Show invitation content
			document.getElementById("guestName").textContent = `Dear ${invitation.name} (${invitation.pronoun})`;
			document.getElementById("message").textContent = invitation.message;
			document.getElementById("invitationContent").style.display = "block";
		} else {
			// Invitation not found, show default
			console.log("Invitation not found");
		}
	} catch (error) {
		console.error("Error loading invitation:", error);
	} finally {
		loading.style.display = "none";
		content.style.display = "block";
	}
};

const init = async () => {
	await loadInvitation();
	await loadExistingRSVP();

	new fullpage("#fullpage", {
		anchors: ["cover", "intro", "author", "info", "invite", "footer"],
		licenseKey: "O46NH-O2JJ9-B3K9J-4C9JK-XSZZO",
		scrollHorizontallyKey: "14F2D5AA-58024B8B-8AA10EE2-B714B3F4",
		autoScrolling: true,
		scrollHorizontally: true,
		navigation: true,
		navigationPosition: "right",
		navigationTooltips: ["封面", "介紹", "藝術家", "展覽資訊", "邀請函", "Credits"],
		credits: {
			enabled: false
		},
		css3: false,
		scrollingSpeed: 1000
	});

	// Map initialization
	const lat = 25.0577752;
	const lng = 121.5459258;

	const map = L.map("map").setView([lat, lng], 16);

	// 黑白底圖（CartoDB / OpenStreetMap）
	L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
		maxZoom: 200
	}).addTo(map);

	// Marker
	L.marker([lat, lng]).addTo(map).bindPopup("台北市民生東路三段 113 巷 7 弄 10 號 B1").openPopup();
};

window.onload = init;
