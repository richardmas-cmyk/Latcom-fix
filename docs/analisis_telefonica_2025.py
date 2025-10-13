#!/usr/bin/env python3
"""
Análisis de Disparidades Telefónica vs Latcom - 2025
Comparación exhaustiva de transacciones por MSISDN y TRANSACTION_ID
"""

import pandas as pd
import os
from datetime import datetime
import glob

print("=" * 80)
print("🔍 ANÁLISIS TELEFÓNICA vs LATCOM - 2025")
print("=" * 80)

# Directorios
TELEFONICA_DIR = "/Users/richardmas/Downloads/Ficheros 2025 gustavo"
LATCOM_DIR = "/Users/richardmas/Downloads/Excel Workings/2025"
OUTPUT_DIR = "/Users/richardmas/latcom-fix/analisis_2025"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================
# PASO 0: Cargar todos los archivos
# ============================================
print("\n📂 PASO 0: Cargando archivos...")

# Cargar archivos de Telefónica
print("\n   Telefónica (Proveedor):")
telefonica_files = glob.glob(f"{TELEFONICA_DIR}/*.xlsx")
telefonica_dfs = []

for file in telefonica_files:
    print(f"      Cargando {os.path.basename(file)}...", end=' ')
    df = pd.read_excel(file)
    telefonica_dfs.append(df)
    print(f"✅ {len(df):,} rows")

telefonica = pd.concat(telefonica_dfs, ignore_index=True)
print(f"\n   ✅ Total Telefónica: {len(telefonica):,} transacciones")

# Cargar archivos de Latcom
print("\n   Latcom (Mi Sistema):")
latcom_files = glob.glob(f"{LATCOM_DIR}/*.csv")
latcom_dfs = []

for file in latcom_files:
    print(f"      Cargando {os.path.basename(file)}...", end=' ')
    df = pd.read_csv(file)
    latcom_dfs.append(df)
    print(f"✅ {len(df):,} rows")

latcom = pd.concat(latcom_dfs, ignore_index=True)
print(f"\n   ✅ Total Latcom: {len(latcom):,} transacciones")

# Limpiar y preparar datos
print("\n🔧 Preparando datos para matching...")

# Telefónica: usar TRANSACTION_ID directamente
telefonica['TX_ID'] = telefonica['TRANSACTION_ID'].astype(str).str.strip().str.upper()
telefonica['MSISDN_CLEAN'] = telefonica['MSISDN'].astype(str).str.strip()
telefonica['STATUS_CLEAN'] = telefonica['STATUS'].str.upper().str.strip()

# Latcom: VENDOR_TRANSACTION_ID es el equivalente
latcom['TX_ID'] = latcom['VENDOR_TRANSACTION_ID'].astype(str).str.strip().str.upper()
latcom['MSISDN_CLEAN'] = latcom['MSISDN'].astype(str).str.strip()
latcom['STATUS_CLEAN'] = latcom['STATUS'].str.upper().str.strip()

# Crear key compuesto: MSISDN + TRANSACTION_ID + STATUS
telefonica['KEY_WITH_STATUS'] = telefonica['MSISDN_CLEAN'] + '_' + telefonica['TX_ID'] + '_' + telefonica['STATUS_CLEAN']
latcom['KEY_WITH_STATUS'] = latcom['MSISDN_CLEAN'] + '_' + latcom['TX_ID'] + '_' + latcom['STATUS_CLEAN']

# Crear key sin status para matching cruzado
telefonica['KEY_NO_STATUS'] = telefonica['MSISDN_CLEAN'] + '_' + telefonica['TX_ID']
latcom['KEY_NO_STATUS'] = latcom['MSISDN_CLEAN'] + '_' + latcom['TX_ID']

print(f"   ✅ Datos preparados")

# ============================================
# PASO 1: SUCCESS en Telefónica = SUCCESS en Latcom
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 1: Transacciones SUCCESS coincidentes")
print("=" * 80)

telefonica_success = telefonica[telefonica['STATUS_CLEAN'] == 'SUCCESS'].copy()
latcom_success = latcom[latcom['STATUS_CLEAN'] == 'SUCCESS'].copy()

# Match por MSISDN + TRANSACTION_ID + SUCCESS
success_match = telefonica_success[
    telefonica_success['KEY_WITH_STATUS'].isin(latcom_success['KEY_WITH_STATUS'])
].copy()

print(f"\n✅ Encontradas {len(success_match):,} transacciones SUCCESS coincidentes")
print(f"   Total en Telefónica SUCCESS: {len(telefonica_success):,}")
print(f"   Total en Latcom SUCCESS: {len(latcom_success):,}")
print(f"   Coincidencias: {len(success_match):,} ({len(success_match)/len(telefonica_success)*100:.1f}%)")

# Guardar coincidencias SUCCESS
success_file = f"{OUTPUT_DIR}/01_COINCIDENCIAS_SUCCESS.csv"
success_match.to_csv(success_file, index=False)
print(f"\n💾 Guardado: {success_file}")

# ============================================
# PASO 2: FAIL en Telefónica = FAIL en Latcom
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 2: Transacciones FAIL coincidentes")
print("=" * 80)

telefonica_fail = telefonica[telefonica['STATUS_CLEAN'] == 'FAIL'].copy()
latcom_fail = latcom[latcom['STATUS_CLEAN'] == 'FAIL'].copy()

# Match por MSISDN + TRANSACTION_ID + FAIL
fail_match = telefonica_fail[
    telefonica_fail['KEY_WITH_STATUS'].isin(latcom_fail['KEY_WITH_STATUS'])
].copy()

print(f"\n✅ Encontradas {len(fail_match):,} transacciones FAIL coincidentes")
print(f"   Total en Telefónica FAIL: {len(telefonica_fail):,}")
print(f"   Total en Latcom FAIL: {len(latcom_fail):,}")
print(f"   Coincidencias: {len(fail_match):,} ({len(fail_match)/len(telefonica_fail)*100:.1f}%)")

# Guardar coincidencias FAIL
fail_file = f"{OUTPUT_DIR}/02_COINCIDENCIAS_FAIL.csv"
fail_match.to_csv(fail_file, index=False)
print(f"\n💾 Guardado: {fail_file}")

# ============================================
# PASO 3: Telefónica2 (sin coincidencias exactas)
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 3: Generando Telefónica2 (Disparidades)")
print("=" * 80)

# Eliminar todas las coincidencias exactas (SUCCESS-SUCCESS y FAIL-FAIL)
matched_keys = set(success_match['KEY_WITH_STATUS']).union(set(fail_match['KEY_WITH_STATUS']))
telefonica2 = telefonica[~telefonica['KEY_WITH_STATUS'].isin(matched_keys)].copy()

print(f"\n📋 Telefónica Original: {len(telefonica):,} transacciones")
print(f"   Coincidencias eliminadas: {len(matched_keys):,}")
print(f"   Telefónica2 (Disparidades): {len(telefonica2):,} transacciones")

telefonica2_file = f"{OUTPUT_DIR}/03_TELEFONICA2_DISPARIDADES.csv"
telefonica2.to_csv(telefonica2_file, index=False)
print(f"\n💾 Guardado: {telefonica2_file}")

# ============================================
# PASO 4: SUCCESS en Telefónica2 = FAIL en Latcom
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 4: SUCCESS en Telefónica → FAIL en Latcom")
print("=" * 80)

telefonica2_success = telefonica2[telefonica2['STATUS_CLEAN'] == 'SUCCESS'].copy()

# Buscar en Latcom con el mismo MSISDN + TX_ID pero status FAIL
success_to_fail = []

for _, tel_row in telefonica2_success.iterrows():
    key = tel_row['KEY_NO_STATUS']
    # Buscar en Latcom FAIL con mismo key
    latcom_matches = latcom_fail[latcom_fail['KEY_NO_STATUS'] == key]

    if len(latcom_matches) > 0:
        latcom_row = latcom_matches.iloc[0]
        success_to_fail.append({
            'DATE_TELEFONICA': tel_row['DATETIME'],
            'DATE_LATCOM': latcom_row['DATETIME'],
            'MSISDN': tel_row['MSISDN'],
            'TRANSACTION_ID': tel_row['TRANSACTION_ID'],
            'PRODUCT_TELEFONICA': tel_row.get('PRODUCT_TYPE', ''),
            'AMOUNT': tel_row['AMOUNT'],
            'STATUS_TELEFONICA': 'SUCCESS',
            'STATUS_LATCOM': 'FAIL',
            'VENDOR_RESPONSE_MESSAGE': latcom_row.get('VENDOR_RESPONSE_MESSAGE', ''),
            # Incluir todos los campos de Telefónica
            **{f'TEL_{k}': v for k, v in tel_row.items()}
        })

success_to_fail_df = pd.DataFrame(success_to_fail)

print(f"\n⚠️  Encontradas {len(success_to_fail_df):,} transacciones con STATUS diferente")
print(f"   Telefónica dice SUCCESS, Latcom dice FAIL")

if len(success_to_fail_df) > 0:
    success_to_fail_file = f"{OUTPUT_DIR}/04_SUCCESS_TELEFONICA_FAIL_LATCOM.csv"
    success_to_fail_df.to_csv(success_to_fail_file, index=False)
    print(f"\n💾 Guardado: {success_to_fail_file}")

# ============================================
# PASO 5: FAIL en Telefónica2 = SUCCESS en Latcom
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 5: FAIL en Telefónica → SUCCESS en Latcom")
print("=" * 80)

telefonica2_fail = telefonica2[telefonica2['STATUS_CLEAN'] == 'FAIL'].copy()

# Buscar en Latcom con el mismo MSISDN + TX_ID pero status SUCCESS
fail_to_success = []

for _, tel_row in telefonica2_fail.iterrows():
    key = tel_row['KEY_NO_STATUS']
    # Buscar en Latcom SUCCESS con mismo key
    latcom_matches = latcom_success[latcom_success['KEY_NO_STATUS'] == key]

    if len(latcom_matches) > 0:
        latcom_row = latcom_matches.iloc[0]
        fail_to_success.append({
            'DATE_TELEFONICA': tel_row['DATETIME'],
            'DATE_LATCOM': latcom_row['DATETIME'],
            'MSISDN': tel_row['MSISDN'],
            'TRANSACTION_ID': tel_row['TRANSACTION_ID'],
            'PRODUCT_TELEFONICA': tel_row.get('PRODUCT_TYPE', ''),
            'AMOUNT': tel_row['AMOUNT'],
            'STATUS_TELEFONICA': 'FAIL',
            'STATUS_LATCOM': 'SUCCESS',
            'VENDOR_RESPONSE_MESSAGE_TELEFONICA': tel_row.get('VENDOR_RESPONSE_MESSAGE', ''),
            'VENDOR_RESPONSE_MESSAGE_LATCOM': latcom_row.get('VENDOR_RESPONSE_MESSAGE', ''),
            # Incluir todos los campos de Telefónica
            **{f'TEL_{k}': v for k, v in tel_row.items()}
        })

fail_to_success_df = pd.DataFrame(fail_to_success)

print(f"\n⚠️  Encontradas {len(fail_to_success_df):,} transacciones con STATUS diferente")
print(f"   Telefónica dice FAIL, Latcom dice SUCCESS")

if len(fail_to_success_df) > 0:
    fail_to_success_file = f"{OUTPUT_DIR}/05_FAIL_TELEFONICA_SUCCESS_LATCOM.csv"
    fail_to_success_df.to_csv(fail_to_success_file, index=False)
    print(f"\n💾 Guardado: {fail_to_success_file}")

# ============================================
# PASO 6: Telefónica3 (sin coincidencias de status cruzado)
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 6: Generando Telefónica3 (Sin Coincidencia)")
print("=" * 80)

# Eliminar las transacciones con status cruzado
cross_matched_keys = set()
if len(success_to_fail_df) > 0:
    cross_matched_keys.update(success_to_fail_df['TEL_KEY_NO_STATUS'].values)
if len(fail_to_success_df) > 0:
    cross_matched_keys.update(fail_to_success_df['TEL_KEY_NO_STATUS'].values)

telefonica3 = telefonica2[~telefonica2['KEY_NO_STATUS'].isin(cross_matched_keys)].copy()

print(f"\n📋 Telefónica2: {len(telefonica2):,} transacciones")
print(f"   Coincidencias cruzadas eliminadas: {len(cross_matched_keys):,}")
print(f"   Telefónica3 (Sin Coincidencia): {len(telefonica3):,} transacciones")

telefonica3_file = f"{OUTPUT_DIR}/06_TELEFONICA3_SIN_COINCIDENCIA.csv"
telefonica3.to_csv(telefonica3_file, index=False)
print(f"\n💾 Guardado: {telefonica3_file}")

# ============================================
# PASO 7: SUCCESS sin coincidencia (Impacto Económico)
# ============================================
print("\n" + "=" * 80)
print("📊 PASO 7: SUCCESS sin Coincidencia - Impacto Económico")
print("=" * 80)

telefonica3_success_only = telefonica3[telefonica3['STATUS_CLEAN'] == 'SUCCESS'].copy()

print(f"\n💰 TRANSACCIONES SUCCESS SIN COINCIDENCIA:")
print(f"   Cantidad: {len(telefonica3_success_only):,} transacciones")

if len(telefonica3_success_only) > 0:
    total_amount = telefonica3_success_only['AMOUNT'].sum()
    print(f"   Monto total: ${total_amount:,.2f} USD")
    print(f"   Monto promedio: ${telefonica3_success_only['AMOUNT'].mean():.2f} USD")

    success_only_file = f"{OUTPUT_DIR}/07_SUCCESS_SIN_COINCIDENCIA_IMPACTO.csv"
    telefonica3_success_only.to_csv(success_only_file, index=False)
    print(f"\n💾 Guardado: {success_only_file}")

# ============================================
# RESUMEN FINAL
# ============================================
print("\n" + "=" * 80)
print("📋 RESUMEN FINAL DEL ANÁLISIS")
print("=" * 80)

print(f"""
TRANSACCIONES TELEFÓNICA 2025:    {len(telefonica):,}

COINCIDENCIAS EXACTAS:
  ✅ SUCCESS-SUCCESS:              {len(success_match):,} ({len(success_match)/len(telefonica)*100:.1f}%)
  ✅ FAIL-FAIL:                    {len(fail_match):,} ({len(fail_match)/len(telefonica)*100:.1f}%)
  ─────────────────────────────────────────
  TOTAL COINCIDENCIAS:             {len(success_match) + len(fail_match):,} ({(len(success_match) + len(fail_match))/len(telefonica)*100:.1f}%)

DISPARIDADES (Telefónica2):        {len(telefonica2):,} ({len(telefonica2)/len(telefonica)*100:.1f}%)

COINCIDENCIAS CON STATUS DIFERENTE:
  ⚠️  SUCCESS (Tel) → FAIL (Lat):  {len(success_to_fail_df):,}
  ⚠️  FAIL (Tel) → SUCCESS (Lat):  {len(fail_to_success_df):,}
  ─────────────────────────────────────────
  TOTAL STATUS CRUZADO:            {len(success_to_fail_df) + len(fail_to_success_df):,}

SIN COINCIDENCIA (Telefónica3):    {len(telefonica3):,} ({len(telefonica3)/len(telefonica)*100:.1f}%)
  - SUCCESS sin match:             {len(telefonica3_success_only):,}
  - FAIL sin match:                {len(telefonica3[telefonica3['STATUS_CLEAN'] == 'FAIL']):,}
""")

if len(telefonica3_success_only) > 0:
    print(f"""
💰 IMPACTO ECONÓMICO (SUCCESS sin coincidencia):
   Transacciones: {len(telefonica3_success_only):,}
   Monto Total:   ${telefonica3_success_only['AMOUNT'].sum():,.2f} USD
""")

# ============================================
# RESUMEN EN ARCHIVO
# ============================================
summary_file = f"{OUTPUT_DIR}/00_RESUMEN_ANALISIS.txt"
with open(summary_file, 'w') as f:
    f.write("=" * 80 + "\n")
    f.write("ANÁLISIS TELEFÓNICA vs LATCOM - 2025\n")
    f.write("=" * 80 + "\n\n")
    f.write(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

    f.write(f"TRANSACCIONES TELEFÓNICA 2025: {len(telefonica):,}\n\n")

    f.write("ARCHIVOS GENERADOS:\n")
    f.write("  1. 01_COINCIDENCIAS_SUCCESS.csv\n")
    f.write(f"     → {len(success_match):,} transacciones SUCCESS coincidentes\n\n")

    f.write("  2. 02_COINCIDENCIAS_FAIL.csv\n")
    f.write(f"     → {len(fail_match):,} transacciones FAIL coincidentes\n\n")

    f.write("  3. 03_TELEFONICA2_DISPARIDADES.csv\n")
    f.write(f"     → {len(telefonica2):,} transacciones sin coincidencia exacta\n\n")

    f.write("  4. 04_SUCCESS_TELEFONICA_FAIL_LATCOM.csv\n")
    f.write(f"     → {len(success_to_fail_df):,} transacciones con status diferente\n\n")

    f.write("  5. 05_FAIL_TELEFONICA_SUCCESS_LATCOM.csv\n")
    f.write(f"     → {len(fail_to_success_df):,} transacciones con status diferente\n\n")

    f.write("  6. 06_TELEFONICA3_SIN_COINCIDENCIA.csv\n")
    f.write(f"     → {len(telefonica3):,} transacciones sin ninguna coincidencia\n\n")

    f.write("  7. 07_SUCCESS_SIN_COINCIDENCIA_IMPACTO.csv\n")
    f.write(f"     → {len(telefonica3_success_only):,} transacciones SUCCESS sin match\n")
    if len(telefonica3_success_only) > 0:
        f.write(f"     → Impacto: ${telefonica3_success_only['AMOUNT'].sum():,.2f} USD\n")

print(f"\n💾 Resumen guardado: {summary_file}")
print("\n" + "=" * 80)
print("✅ ANÁLISIS COMPLETO!")
print("=" * 80)
print(f"\nTodos los archivos guardados en: {OUTPUT_DIR}/")
