# Pregunta para Adriana - CSQ Integration

## Fecha: 2025-10-13

Hola Adriana,

Gracias por el formato correcto. Ya lo implementamos y está funcionando parcialmente:

## Estado Actual ✅

**Formato implementado correctamente:**
```json
{
    "localDateTime": "2025-10-13T11:01:33",
    "account": "5527642763",
    "amountToSendX100": 2000
}
```

**Endpoint usado:**
```
POST /pre-paid/recharge/purchase/173103/{operatorId}/{reference}
```

## Problema 🔴

Estamos recibiendo diferentes códigos de error dependiendo del operator ID:

### Operator ID 396 (Telcel SKU):
```json
{
  "rc": -1,
  "resultcode": "-1",
  "resultmessage": "Producto no disponible en ruta"
}
```

### Operator ID 1 (Telcel genérico):
```json
{
  "rc": -1,
  "resultcode": "991",
  "resultmessage": "System error"
}
```

## Pregunta ❓

**¿Cuál operator ID / SKU debemos usar con el terminal 173103 para Telcel México?**

Probamos:
- ❌ Operator 1 → Error 991 (System error)
- ❌ Operator 396 → Producto no disponible en ruta
- ❌ Operator 2 (Movistar)
- ❌ Operator 3 (AT&T)
- ❌ SKU 683 (Amigo Sin Limites)
- ❌ SKU 684 (Internet Amigo)

## Información Adicional

- **Terminal**: 173103
- **Username**: DEVELOPUS
- **Teléfono de prueba**: 5527642763 (Telcel México)
- **Monto**: 20 MXN (2000 en centavos)
- **Autenticación**: ✅ Funcionando correctamente
- **Balance**: ✅ $2,088 USD disponible

## Necesitamos Saber:

1. **¿Qué operator ID está habilitado para este terminal de desarrollo?**
2. **¿El formato del número de teléfono es correcto?** (10 dígitos sin código de país)
3. **¿Hay alguna configuración adicional necesaria para el terminal 173103?**

Muchas gracias por tu ayuda.

---

**Contact**: Richard
**Terminal**: 173103 (DEVELOPUS)
