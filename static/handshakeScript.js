const socket = io();

socket.emit("closePrevious");

let savedCapturesButton = document.querySelector("#showSavedCaptures");
let showSavedCaptures = document.querySelector("#savedCaptures");
let interfaceList = document.querySelector(".interfaceList");
let scanButton = document.querySelector(".scanButton");
let showTable = document.querySelector("#showTable");
let checkBoxes = document.querySelector("#options");
let boxes = document.querySelectorAll(".boxes");
let APTable = document.querySelector("#APTable");
let currentImage = 0, columnChecks = [], deviceImages = ["smartphone.svg", "tablet.svg", "printer.svg", "laptop.svg", "ac.svg", "iot.svg", "tv.svg", "assistant.svg"];

// Show Saved Capture Files //
savedCapturesButton.addEventListener("click", () => {
    socket.emit("showFiles", null, (data) => {
        let tableData = "";

        data["name"].forEach((val, index) => {
            if (val === "No Files Found") {
                tableData += `<tr><td>${val}</td><td>${data["date"][index]}</td><td>${data["size"][index]}</td>`;
            } else {
                tableData += `<tr onclick="window.location.href='/captureFile/${val}'"><td>${val}</td><td>${data["date"][index]}</td><td>${data["size"][index]}</td>`;
            }
        });

        document.querySelector("#captureFiles").innerHTML = tableData;

        showSavedCaptures.showModal();
        showSavedCaptures.style.opacity = "1";
        showSavedCaptures.style.visibility = "visible";
    })
});
// Show Saved Capture Files //


// Set Cookie //
function setCookie (name, value) {
    document.cookie = `${name}=${value}; expires=Sun, 1 January 2100 12:00:00 UTC;`;
}
// Set Cookie //


// Get Cookie //
function getCookie (name) {
    let value = null;
    document.cookie.split("; ").forEach((v) => {
        v = v.split("=");
        if (v[0] === name) {
            value = v[1];
        }
    });

    return value;
}
// Get Cookie //


// Get Interfaces //
socket.emit("getInterfaces", null, (data) => {
    let interfaceArray = [...new Set(data)];

    let options = "";
    interfaceArray.forEach(interface => {
        options += `<option>${interface}</option>`;
    });

    interfaceList.innerHTML = options;
    if (interfaceArray.indexOf(getCookie("preferredInterface")) !== -1) {
        interfaceList.value = getCookie("preferredInterface");
    }

    // Start Scan //
    if (interfaceList.value !== "No Wireless Interface Found") {
        scanButton.addEventListener("click", startScan);
        document.addEventListener("keypress", startScan);
        function startScan (e) {
            if (e.key === "Enter" || e.type === "click") {
                document.removeEventListener("keypress", startScan);
                showTable.showModal();
                document.addEventListener("keyup", refresh);
                showTable.style.visibility = "visible";
                showTable.style.opacity = 1;
                document.querySelector("#heading").innerHTML = `Scanning on ${interfaceList.value}<div></div>`;
                setChecks();
                setCookie("preferredInterface", interfaceList.value);
                socket.emit("startScan", interfaceList.value.slice(0, interfaceList.value.length - 9));
            }
        }
    }
    // Start Scan //
});
// Get Interfaces //


// Parse Table //
socket.on("table", (data) => {
    APTable.innerHTML = data;
    document.querySelector("#tablefoot").innerHTML = document.querySelector("#tablehead").innerHTML;
    document.querySelector("#info").innerText = `Click any Access Point to Start Attacking (${document.querySelectorAll(".APs").length})`;
});
// Parse Table //


// Refresh //
function refresh (e) {
    if (e.key === "Escape") {
        socket.emit("stopScan");
        window.location.reload();
    }
}
// Refresh //


// Set Table Columns //
function setChecks () {
    if (getCookie("columnChecks") !== null) {
        columnChecks = JSON.parse(getCookie("columnChecks"));
    } else {
        if (window.screen.availHeight > window.screen.availWidth) {
            columnChecks = [false, false, true, true, false];
        } else {
            columnChecks = [false, true, true, true, true];
        }
    }
    columnChecks.forEach((check, key) => {
        boxes[key].checked = check;
    });

    socket.emit("columns", columnChecks);
}
// Set Table Columns //


// Update Columns Display //
checkBoxes.addEventListener("click", (e) => {
    columnChecks = [];
    if (e.target.localName === "label") return;
    boxes.forEach((box) => {
        columnChecks.push(box.checked);
    });
    setCookie("columnChecks", JSON.stringify(columnChecks));
    socket.emit("columns", columnChecks);
});
// Update Columns Display //


// Send Attack Victim Index //
APTable.addEventListener("click", (e) => {
    if (e.target.localName === "th" || e.target.localName === "tr") { return; }

    showTable.innerHTML = "<pre id='heading'><div></div></pre><div id='attack'><div class='attackInfo' id='APInfo'></div><div class='attackInfo' id='deauthStatus'><h3>Deauthenticating Clients</h3><img id='deauthImages'></img></div><div class='attackInfo' id='eapolStatus'><h3 id='eapolMessage'>Awaiting EAPOL Packet</h3><img id='eapolStatusImage' src='static/Assets/passkey.svg'></img></div>"

    socket.emit("startEAPOLAttack", [e.target.parentElement.getAttribute("index") - 1, interfaceList.value.slice(0, interfaceList.value.length - 9)], (AP) => {
        document.querySelector("#heading").innerHTML = `Attacking ${AP}<div></div>`;
    });
});
// Send Attack Victim Index //


// Show Attack Info //
socket.on("attackInfo", (data) => {
    let attackInfo = document.querySelector("#attack");
    attackInfo.style.visibility = "visible";
    attackInfo.style.opacity = "1";
    let APInfo = document.querySelector("#APInfo");
    let deauthImages = document.querySelector("#deauthImages");

    APInfo.innerHTML = `<h3>Attack Details</h3><pre><b>ESSID:</b> ${data[0]}</pre><pre><b>BSSID:</b> ${data[1]}</pre><pre><b>Channel:</b> ${data[2]}</pre><pre><b>Signal Strength:</b> ${data[3]}</pre><pre><b>Security:</b> ${data[4]}</pre><pre><b>Clients Found:</b> ${data[5]}</pre>`;

    deauthImages.setAttribute("src", `static/Assets/${deviceImages[currentImage++]}`);

    if (currentImage === 8) { currentImage = 0; }
});
// Show Attack Info //


// EAPOL Found Event //
socket.on("eapolFound", () => {
    let eapolStatusImage = document.querySelector("#eapolStatusImage");
    let buttonDiv = document.createElement("div");
    let downloadButton = document.createElement("a");

    buttonDiv.setAttribute("id", "buttonDiv");
    downloadButton.innerText = "Download Capture File";
    downloadButton.setAttribute("id", "downloadButton");
    downloadButton.setAttribute("href", "/captureFile");

    document.querySelector("#heading").innerText = "Handshake Captured";
    eapolStatusImage.setAttribute("src", "static/Assets/tick.svg");
    eapolStatusImage.style.animation = "none";
    eapolStatusImage.style.opacity = "1";
    document.querySelector("#eapolMessage").innerText = "EAPOL Packet Captured";

    buttonDiv.appendChild(downloadButton);
    showTable.appendChild(buttonDiv);
});
// EAPOL Found Event //