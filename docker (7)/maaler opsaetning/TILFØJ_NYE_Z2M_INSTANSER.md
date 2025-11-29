# 🔧 Guide: Tilføj Nye Z2M Instanser til MQTT Config Service

## 📋 Oversigt

Denne service konfigurerer automatisk alle Tongou TO-Q-SY1-JZT målere på tværs af flere Zigbee2MQTT (Z2M) instanser.

**Nuværende setup:**
- ✅ `zigbee2mqtt` (port 8082) - Area 1 - 6 målere
- ✅ `zigbee2mqtt_area2` (port 8083) - Area 2 - 43 målere

---

## 🚀 Når I Tilføjer Nye Z2M Instanser

### **Eksempel: Tilføj Area 3, 4, 5 og 6**

#### **Trin 1: Opsæt nye Z2M instanser**

For hver ny SLZB-06M coordinator:

1. **Installer Z2M container** på NAS
2. **Konfigurer MQTT topic** til unikt navn:
   - Area 3: `zigbee2mqtt_area3`
   - Area 4: `zigbee2mqtt_area4`
   - Area 5: `zigbee2mqtt_area5`
   - Area 6: `zigbee2mqtt_area6`
3. **Vælg unik port** for web UI:
   - Area 3: Port 8084
   - Area 4: Port 8085
   - Area 5: Port 8086
   - Area 6: Port 8087

#### **Trin 2: Opdater MQTT Config Service**

**A. Rediger `server.js` fil:**

Find denne linje (omkring linje 22):
```javascript
const Z2M_TOPICS = ['zigbee2mqtt', 'zigbee2mqtt_area2'];
```

Opdater til:
```javascript
const Z2M_TOPICS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',
  'zigbee2mqtt_area4',
  'zigbee2mqtt_area5',
  'zigbee2mqtt_area6',
];
```

**B. Upload opdateret fil til NAS:**

Via File Station:
1. Gå til `/docker/maaler opsaetning/`
2. Upload den opdaterede `server.js` fil
3. Overskriv den gamle fil

**C. Genbyg container via SSH:**

```bash
ssh jc@192.168.9.61
cd "/volume1/docker/maaler opsaetning"
sudo docker-compose down
sudo docker-compose up -d --build
```

**D. Verificer:**

```bash
sudo docker logs mqtt-config-service
```

Forventet output:
```
🚀 MQTT Config Service running on port 3001
📡 MQTT Broker: mqtt://192.168.9.61:1890
🎯 Z2M Topics: zigbee2mqtt, zigbee2mqtt_area2, zigbee2mqtt_area3, zigbee2mqtt_area4, zigbee2mqtt_area5, zigbee2mqtt_area6
```

#### **Trin 3: Test**

1. Gå til http://localhost:8080/admin/maalere
2. Klik "Konfigurer Målere"
3. Servicen finder nu målere fra ALLE 6 Z2M instanser!

---

## 📝 Tjekliste for Nye Z2M Instanser

- [ ] Z2M container opsat på NAS
- [ ] Unikt MQTT topic konfigureret (f.eks. `zigbee2mqtt_area3`)
- [ ] Unik web UI port (f.eks. 8084)
- [ ] Coordinator parret og fungerer
- [ ] `server.js` opdateret med nyt topic
- [ ] Fil uploadet til NAS
- [ ] Container genbygget (`docker-compose down && docker-compose up -d --build`)
- [ ] Logs verificeret (`docker logs mqtt-config-service`)
- [ ] Testet fra admin panel

---

## 🎯 Best Practices

### **Navngivning af Z2M Topics**

Brug konsistent navngivning:
- ✅ `zigbee2mqtt` (hovednetværk)
- ✅ `zigbee2mqtt_area2`, `zigbee2mqtt_area3`, osv. (områder)
- ❌ Undgå: `z2m_2`, `zigbee_area2`, `area2` (inkonsistent)

### **Port Allokering**

Hold styr på porte:
| Z2M Instance | MQTT Topic | Web UI Port |
|--------------|------------|-------------|
| Area 1 | zigbee2mqtt | 8082 |
| Area 2 | zigbee2mqtt_area2 | 8083 |
| Area 3 | zigbee2mqtt_area3 | 8084 |
| Area 4 | zigbee2mqtt_area4 | 8085 |
| Area 5 | zigbee2mqtt_area5 | 8086 |
| Area 6 | zigbee2mqtt_area6 | 8087 |

### **MQTT Broker**

Alle Z2M instanser skal bruge **samme MQTT broker**:
- IP: `192.168.9.61`
- Port: `1890` (ekstern) / `1883` (intern Docker)
- Brugernavn: `homeassistant`
- Password: `7200Grindsted!`

---

## 🐛 Fejlfinding

### Problem: Servicen finder ikke målere fra ny Z2M instance

**Løsning:**
1. Tjek at topic er tilføjet til `Z2M_TOPICS` array
2. Tjek at Z2M instance bruger korrekt MQTT broker
3. Tjek at Z2M instance bruger korrekt topic navn
4. Genbyg container

### Problem: Container starter ikke efter opdatering

**Løsning:**
```bash
# Se fejlmeddelelser
sudo docker logs mqtt-config-service

# Tjek syntax fejl i server.js
sudo docker-compose config

# Genbyg fra scratch
sudo docker-compose down
sudo docker rmi maaleropsaetning-mqtt-config-service
sudo docker-compose up -d --build
```

### Problem: Målere konfigureres ikke

**Løsning:**
1. Tjek at målere er parret i Z2M
2. Tjek at målere er model `TO-Q-SY1-JZT`
3. Se logs: `sudo docker logs -f mqtt-config-service`
4. Verificer MQTT forbindelse virker

---

## 📊 Monitoring

### Se hvilke målere der blev konfigureret

```bash
sudo docker logs mqtt-config-service | grep "✅ Configured"
```

### Se om der var fejl

```bash
sudo docker logs mqtt-config-service | grep "❌"
```

### Se antal målere fundet

```bash
sudo docker logs mqtt-config-service | grep "Found"
```

---

## 🔄 Hurtig Reference

### Opdater service efter nye Z2M instanser:

```bash
# 1. Rediger server.js lokalt (tilføj nye topics)

# 2. Upload til NAS via File Station eller SCP
scp server.js jc@192.168.9.61:"/volume1/docker/maaler opsaetning/"

# 3. SSH til NAS
ssh jc@192.168.9.61

# 4. Genbyg container
cd "/volume1/docker/maaler opsaetning"
sudo docker-compose down
sudo docker-compose up -d --build

# 5. Verificer
sudo docker logs mqtt-config-service

# 6. Test fra admin panel
# http://localhost:8080/admin/maalere
```

---

## 📞 Support

Hvis problemer fortsætter:

1. **Tjek Z2M logs:**
   - http://192.168.9.61:8082 → Logs (Area 1)
   - http://192.168.9.61:8083 → Logs (Area 2)
   - osv.

2. **Tjek MQTT broker:**
   ```bash
   sudo docker logs mosquitto
   ```

3. **Tjek service logs:**
   ```bash
   sudo docker logs -f mqtt-config-service
   ```

---

## ✅ Eksempel: Komplet Opdatering

**Scenario:** Tilføjer Area 3 med 100 nye målere

**server.js INDEN:**
```javascript
const Z2M_TOPICS = ['zigbee2mqtt', 'zigbee2mqtt_area2'];
```

**server.js EFTER:**
```javascript
const Z2M_TOPICS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',  // <-- NY LINJE
];
```

**Kommandoer:**
```bash
# Upload fil
scp server.js jc@192.168.9.61:"/volume1/docker/maaler opsaetning/"

# SSH og genbyg
ssh jc@192.168.9.61
cd "/volume1/docker/maaler opsaetning"
sudo docker-compose down
sudo docker-compose up -d --build

# Verificer
sudo docker logs mqtt-config-service
```

**Forventet output:**
```
🚀 MQTT Config Service running on port 3001
📡 MQTT Broker: mqtt://192.168.9.61:1890
🎯 Z2M Topics: zigbee2mqtt, zigbee2mqtt_area2, zigbee2mqtt_area3
```

**Test fra admin panel:**
```
Konfigurerer 149 målere...  (49 + 100 nye)
✅ 149 målere konfigureret succesfuldt!
```

---

**Sidst opdateret:** 13. November 2025  
**Version:** 1.0  
**Forfatter:** Cascade AI Assistant
