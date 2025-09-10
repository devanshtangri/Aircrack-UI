const socket = io();

socket.emit("closePrevious");

let interfaceList = document.querySelector(".interfaceList");
let interfaceArray, attackInterfaces;
let scanButton = document.querySelector(".scanButton");
let showTable = document.querySelector("#showTable");
let checkBoxes = document.querySelector("#options");
let APTable = document.querySelector("table");
let boxes = document.querySelectorAll(".boxes");
let columnChecks = [], APChecks = [], listenerApplied = false;


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
    interfaceArray = [...new Set(data)];

    let options;
    interfaceArray.forEach(interface => {
        options += `<option>${interface}</option>`;
    });

    interfaceList.innerHTML = options;
    if (interfaceArray.indexOf(getCookie("preferredInterface")) !== -1) {
        interfaceList.value = getCookie("preferredInterface");
    }

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
});
// Get Interfaces //


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


// Parse Table //
socket.on("table", (data) => {
    document.querySelector("table").innerHTML = data;
    document.querySelector("tfoot").innerHTML = document.querySelector("thead").innerHTML;
    if (!listenerApplied) {
        document.querySelector("#stopScan").addEventListener("click", endScanning);
        document.addEventListener("keypress", endScanning);
    }
    document.querySelector("#stopScan").innerText = `Stop Scan (${document.querySelectorAll(".APs").length})`;
});
// Parse Table //


// Stop Refresh //
function refresh (input) {
    if (input.key === "Escape") {
        socket.emit("stopScan");
        window.location.reload();
    }
}

function endScanning (input) {
    if (input.key === "Enter" || input.type === "click") {
        document.querySelector("#stopScan").innerText = "Confirm Selection (0)";

        document.querySelector("#stopScan").removeEventListener("click", endScanning);
        document.removeEventListener("keypress", endScanning);

        document.querySelector("#stopScan").addEventListener("click", confirmChoices);
        document.addEventListener("keypress", confirmChoices);

        socket.emit("stopScan");

        document.querySelector("#heading").innerHTML = "Select APs to Attack";
        let newHeader = "<tr><th class='selectAll'>Select All</th><th>ESSID</th><th>Clients</th>"

        if (columnChecks[1]) { newHeader += "<th>BSSID</th>"; }
        if (columnChecks[2]) { newHeader += "<th>Channel</th>"; }
        if (columnChecks[3]) { newHeader += "<th>Signal Strength</th>"; }
        if (columnChecks[4]) { newHeader += "<th>Security</th>"; }

        document.querySelector("thead").innerHTML = newHeader;
        document.querySelector("tfoot").innerHTML = newHeader;

        let APRows = document.querySelectorAll(".APs");
        APRows.forEach((e, k) => {
            e.firstChild.innerHTML = `<input type='checkbox' class='APChecks' id='check${k + 1}'></input>`;
        });


        APTable.addEventListener("click", checkAll);
        document.addEventListener("keypress", checkAll);
        function checkAll (e) {
            let checkedRows;
            if (e.target.getAttribute("class") === "selectAll" || e.key === "a" || e.key === "A") {
                if (document.querySelector(".selectAll").innerText === "Select All") {
                    document.querySelectorAll(".selectAll")[0].innerText = "Deselect All";
                    document.querySelectorAll(".selectAll")[1].innerText = "Deselect All";
                    document.querySelectorAll(".APChecks").forEach((e) => {
                        e.checked = true;
                    });
                } else {
                    document.querySelectorAll(".selectAll")[0].innerText = "Select All";
                    document.querySelectorAll(".selectAll")[1].innerText = "Select All";
                    document.querySelectorAll(".APChecks").forEach((e) => {
                        e.checked = false;
                    });
                }

                checkedRows = document.querySelectorAll(".APChecks:checked").length;
                document.querySelector("#stopScan").innerText = `Confirm Selection (${checkedRows})`;
            }

            if (e.target.localName === "th" || e.target.localName === "tr" || e.target.localName === "label") { return; }

            if (e.target.localName === "input") {
                checkedRows = document.querySelectorAll(".APChecks:checked").length;
                document.querySelector("#stopScan").innerText = `Confirm Selection (${checkedRows})`;
                return;
            }

            if (e.type === "click") {
                document.querySelector(`#check${e.target.parentElement.getAttribute("index")}`).checked = !(document.querySelector(`#check${e.target.parentElement.getAttribute("index")}`).checked);
                checkedRows = document.querySelectorAll(".APChecks:checked").length;
                document.querySelector("#stopScan").innerText = `Confirm Selection (${checkedRows})`;
            }
        }
    }
}
// Stop Scanning //


// Confirm Choices //
function confirmChoices (e) {
    if (e.type === "click" || e.key === "Enter") {

        APChecks = [];
        document.querySelectorAll(".APChecks").forEach((e) => {
            APChecks.push(e.checked);
        });

        if (APChecks.some((val) => val === true)) {
            document.removeEventListener("keypress", confirmChoices);

            showTable.innerHTML = "<pre id='heading'></pre>"
            document.querySelector("#heading").innerHTML = "Select Attack Interfaces";

            let selectInteraces = document.createElement("div");
            selectInteraces.setAttribute("id", "selectInterfaces");

            let options = "";
            interfaceArray.forEach((v) => {
                options += `<li><input type='checkbox' class='attackInterfaces' value='${v}' id='${v.slice(0, interfaceList.value.length - 9)}'><label for='${v.slice(0, interfaceList.value.length - 9)}'>${v}</label></li>`
            });
            options += "<div id='attackOptions'><input type='number' id='packetCount' value='20' placeholder='#' min='5'><button id='startAttack'>Start Attack</button></div>";

            selectInteraces.innerHTML = options;
            showTable.appendChild(selectInteraces);
            
            if (getCookie("packetCount") !== null) {
                document.querySelector("#packetCount").value = getCookie("packetCount");
            }


            if (getCookie("attackInterfaceList") !== null) {
                let data = JSON.parse(getCookie("attackInterfaceList"));
                let attackInterfaceList = Array.from(document.querySelectorAll(".attackInterfaces"));
                attackInterfaceList = attackInterfaceList.map(e => e.value);
                attackInterfaceList.forEach((v) => {
                    if (data.indexOf(v) !== -1) {
                        document.querySelector(`#${v.slice(0, interfaceList.value.length - 9)}`).checked = "true";
                    }
                });
            }

            document.querySelector("#startAttack").addEventListener("click", startAttack);
            document.addEventListener("keypress", startAttack);
        } else {
            alert("Please select atleast one AP to attack");
        }
    }
}
function stopAttack (e) {
    if (e.type === "click" || e.key === "Enter" || e.key === "Escape") {
        socket.emit("stopDeauthAttack");
        window.location.reload();
    }
}
function startAttack (e) {
    if (e.type === "click" || e.key === "Enter") {
        document.removeEventListener("keypress", startAttack);
        let packetCount = document.querySelector("#packetCount").value;

        attackInterfaces = [];

        document.querySelectorAll(".attackInterfaces").forEach((e) => {
            if (e.checked) {
                attackInterfaces.push(e.value);
            }
        });

        if (attackInterfaces.some((val) => typeof (val) === "string")) {
            showTable.innerHTML = "<pre id='heading'></pre><a href='/deauth' id='stopAttack'>Stop Attack</a><div id='deauthInfo'><div>";
            document.querySelector("#heading").innerHTML = "Attacking<div></div>";

            document.addEventListener("keypress", stopAttack);
            document.querySelector("#stopAttack").addEventListener("click", stopAttack);

            let deauthInfo = "";
            attackInterfaces.forEach((val) => {
                deauthInfo += `<div class='infoCards' id='${val.slice(0, interfaceList.value.length - 9)}'></div>`;
            });

            document.querySelector("#deauthInfo").innerHTML = deauthInfo;

            setCookie("attackInterfaceList", JSON.stringify(attackInterfaces));
            setCookie("packetCount", packetCount);

            socket.emit("startDeauthAttack", [attackInterfaces, APChecks, packetCount]);
        } else {
            alert("Please select atleast one WiFi interface");
        }
    }
}
// Confirm Choices //


// Show Deauthentication Info //
socket.on("getDeauthStatus", (data) => {
    deauthStatus = `<h3>${data[0]}</h3><pre><b>ESSID:</b> ${data[1]}</pre><pre><b>BSSID:</b> ${data[2]}</pre><pre><b>Channel:</b> ${data[3]}</pre><pre><b>Signal Strength:</b> ${data[4]}</pre><pre><b>Security:</b> ${data[5]}</pre><pre><b>APs Attacking:</b> ${data[6]}</pre><pre><b>Packets Sent:</b> ${data[7]}</pre>`;
    document.querySelector(`#${data[0]}`).innerHTML = deauthStatus;
    document.querySelector(`#${data[0]}`).style.position = "static";
    document.querySelector(`#${data[0]}`).style.visibility = "visible";
    document.querySelector(`#${data[0]}`).style.opacity = "1";
    document.querySelector("#deauthInfo").style.position = "static";
    document.querySelector("#deauthInfo").style.visibility = "visible";
    document.querySelector("#deauthInfo").style.opacity = "1";
});
// Show Deauthentication Info //