# Email para Adriana - CSQ Support

---

**Asunto:** Seguimiento integración CSQ - Terminal 173103 - Error 991 con DummyTopup

---

Hola Adriana,

Gracias por tu respuesta anterior y la información sobre el endpoint de productos.

Hemos implementado las actualizaciones que nos sugeriste y queremos compartir nuestro progreso y solicitar tu ayuda con un error que estamos encontrando.

## ✅ Actualizaciones Implementadas

### 1. Endpoint de Productos
Implementamos exitosamente la consulta de productos usando el endpoint que nos compartiste:

```
GET https://evsbus.csqworld.com/article/view-set/saleconditions/customer-config/173103/0
Header: Token: 4cdba8f37ecc5ba8994c6a23030c9d4b
```

**Resultado:** ✅ Funciona correctamente
- Recibimos 40 productos configurados para la terminal
- Identificamos DummyTopup (SKU 9990) con denominaciones "From 100 to 1000 step by 1"
- Identificamos AT&T Mexico (SKU 7952) con denominaciones "500, 1000, 1500, 2000, 3000, 5000"

### 2. Comportamiento DummyTopup
Revisamos la documentación que nos compartiste sobre DummyTopup:
🔗 https://csq-docs.apidog.io/doc-1259308

Entendemos que:
- Los últimos 2 dígitos del número de cuenta determinan el código de resultado (rc)
- Ejemplo: cuenta terminada en "10" debería devolver rc=10 (success)
- Ejemplo: cuenta terminada en "13" debería devolver rc=13 (insufficient balance)

## ⚠️ Problema Actual: Error 991 (System Error)

Estamos probando el endpoint de recarga prepagada con DummyTopup pero **todas nuestras solicitudes devuelven error code 991** independientemente de la terminación del número de cuenta.

### Request que Enviamos

**Endpoint:**
```
POST https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/9990/{localRef}
```

**Headers:**
```
U: DEVELOPUS
ST: {unix_timestamp}
SH: {sha256_hash_calculado}
Accept: application/json
Accept-Encoding: gzip
Content-Type: application/json
X-Real-Ip: 0.0.0.0
Cache-Hash: 0
Agent: Relier-Hub/1.0
```

**Body:**
```json
{
  "localDateTime": "2025-10-13T18:05:19",
  "account": "556637468310",
  "amountToSendX100": 500
}
```

**Detalles:**
- Terminal ID: 173103
- SKU ID: 9990 (DummyTopup)
- Local Reference: {8-digit-numeric} (ejemplo: "12345678")
- Cuenta: 556637468310 (termina en "10" para simular success)
- Monto: 500 ($5.00 USD = 500 cents)

### Response que Recibimos

```json
{
  "rc": -1,
  "items": [
    {
      "finalstatus": -1,
      "resultcode": "991",
      "resultmessage": "System error",
      "supplierreference": "",
      "suppliertoken": ""
    }
  ]
}
```

**Resultado:** ❌ Error 991 en todos los casos
- Probamos con cuentas terminadas en: 10, 13, 20, 77, 91
- Todas devuelven el mismo error: rc=991 "System error"
- El error ocurre en aproximadamente 600-800ms

## 🔍 Preguntas

1. **¿El formato de nuestro request es correcto?**
   - ¿El parámetro `amountToSendX100: 500` es correcto para $5 USD?
   - ¿El formato del `localDateTime` ("2025-10-13T18:05:19") es el esperado?
   - ¿El formato del `localRef` (8 dígitos numéricos) es correcto?

2. **¿Los headers de autenticación están completos?**
   - ¿Falta algún header requerido?
   - ¿El cálculo del hash SH es correcto? (SHA256(SHA256(password) + SHA256(timestamp)))

3. **¿Se requieren pasos previos?**
   - ¿Necesitamos llamar primero a `/parameters/` o `/products/` antes de `/purchase/`?
   - ¿O podemos ir directo a `/purchase/` con el SKU ID como estamos haciendo?

4. **¿Hay restricciones en la terminal de desarrollo?**
   - ¿La terminal 173103 tiene permisos para usar DummyTopup?
   - ¿Hay alguna configuración adicional que debamos verificar?

5. **¿El error 991 proporciona más detalles en logs de CSQ?**
   - ¿Podrían revisar sus logs para ver la causa exacta del error?
   - ¿Hay un mensaje más detallado que pueda ayudarnos a identificar el problema?

## 📎 Información Adicional

**Credenciales que estamos usando:**
- Username: DEVELOPUS
- Terminal ID: 173103
- Password: (configurado correctamente según tus instrucciones previas)

**Código de prueba:**
Hemos creado un script de pruebas completo que:
- Consulta productos dinámicamente del endpoint
- Prueba DummyTopup con diferentes terminaciones de cuenta
- Registra todos los requests y responses para debugging

**Próximos pasos que queremos probar:**
1. Resolver el error 991 con DummyTopup
2. Una vez funcionando DummyTopup, probar con AT&T Mexico (SKU 7952)
3. Implementar el flujo completo en producción

## 🙏 Solicitud

¿Podrías ayudarnos a identificar qué está causando el error 991? Cualquier guía sobre el formato correcto del request o configuración adicional necesaria sería muy apreciada.

Quedamos atentos a tus comentarios.

---

**Saludos cordiales,**

Richard
Relier Integration Team

---

## Anexo: Ejemplo de Request Completo

```bash
# Request de ejemplo que podemos reproducir
curl -X POST "https://evsbus.csqworld.com/pre-paid/recharge/purchase/173103/9990/12345678" \
  -H "U: DEVELOPUS" \
  -H "ST: 1697193600" \
  -H "SH: [hash_calculado]" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "localDateTime": "2025-10-13T18:05:19",
    "account": "556637468310",
    "amountToSendX100": 500
  }'
```

**Response esperado (según documentación):**
```json
{
  "rc": 0,
  "items": [{
    "finalstatus": 10,
    "resultcode": "10",
    "resultmessage": "Success",
    "supplierreference": "[tx_id]",
    "suppliertoken": "[token]"
  }]
}
```

**Response que recibimos:**
```json
{
  "rc": -1,
  "items": [{
    "finalstatus": -1,
    "resultcode": "991",
    "resultmessage": "System error",
    "supplierreference": "",
    "suppliertoken": ""
  }]
}
```

---

**Archivos disponibles para revisión:**
- Script de pruebas completo
- Logs detallados de requests/responses
- Código de integración

Podemos compartir cualquier información adicional que necesites para ayudarnos a resolver este problema.

Muchas gracias por tu soporte.
