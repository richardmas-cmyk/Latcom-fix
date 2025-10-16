"""
Run Luis audit for September and October 2024
Validate that automated results match Luis's hand-done audit
"""

import pandas as pd
import os
from datetime import datetime

# Import the Luis analysis function by loading it directly
import importlib.util
spec = importlib.util.spec_from_file_location("luis_audit", "/Users/richardmas/latcom-fix/luis-automated-monthly-audit.py")
luis_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(luis_audit)
luis_three_way_analysis = luis_audit.luis_three_way_analysis

def extract_month_from_temm(temm_file, year, month_num):
    """Extract a specific month from the TEMM file"""
    print(f'\n📦 Extracting {year}-{month_num:02d} from TEMM file...')

    df = pd.read_csv(temm_file, encoding='utf-8-sig')
    df['FECHA'] = pd.to_datetime(df['FECHA'], format='%d/%m/%Y')
    df['Year'] = df['FECHA'].dt.year
    df['Month'] = df['FECHA'].dt.month

    df_month = df[(df['Year'] == year) & (df['Month'] == month_num)].copy()

    temp_file = f'/tmp/temm_{year}_{month_num:02d}.csv'
    df_month.to_csv(temp_file, index=False)

    print(f'   Extracted {len(df_month):,} transactions')

    return temp_file

def extract_sheets_from_latcom(excel_file, adjusted_sheet, total_sheet):
    """Extract adjusted and total sheets from Latcom Excel file"""
    print(f'\n📦 Extracting sheets from {os.path.basename(excel_file)}...')

    df_adjusted = pd.read_excel(excel_file, sheet_name=adjusted_sheet)
    df_total = pd.read_excel(excel_file, sheet_name=total_sheet)

    temp_adjusted = f'/tmp/latcom_adjusted_{adjusted_sheet}.csv'
    temp_total = f'/tmp/latcom_total_{total_sheet}.csv'

    df_adjusted.to_csv(temp_adjusted, index=False)
    df_total.to_csv(temp_total, index=False)

    print(f'   Adjusted: {len(df_adjusted):,} transactions')
    print(f'   Total: {len(df_total):,} transactions')

    return temp_adjusted, temp_total

print('=' * 100)
print('VALIDATING LUIS\'S AUDIT METHODOLOGY')
print('Testing September and October 2023 to match Luis\'s hand-done results')
print('=' * 100)

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Registros_TEMM_NoSoporteActual_202309_202412.csv'
SEPT_FILE = '/Users/richardmas/Downloads/2023 FINAL/FINAL SEPTIEMBRE 20231.xlsx'
OCT_FILE = '/Users/richardmas/Downloads/2023 FINAL/FINAL OCTUBRE 20231.xlsx'

# ============================================================================
# SEPTEMBER 2024 ANALYSIS
# ============================================================================
print('\n\n')
print('╔' + '═' * 98 + '╗')
print('║' + ' ' * 30 + 'SEPTEMBER 2023 AUDIT' + ' ' * 48 + '║')
print('╚' + '═' * 98 + '╝')

print('\n📋 Luis\'s Hand-Done Results for September 2023:')
print('   Telefónica: 6,281 trx, $79k')
print('   Latcom Total: 9,790 trx, $123k')
print('   Latcom Adjusted: 3,869 trx, $49k')
print('   Key finding: Only 41 adjusted transactions in TEMM (practically none)')
print('   Missing from our system: ~400 transactions')

# Extract September data
temm_sept = extract_month_from_temm(TEMM_FILE, 2023, 9)
adjusted_sept, total_sept = extract_sheets_from_latcom(
    SEPT_FILE,
    'ADJUSTED',
    'PAQUETES SEPTIEMBRE23'
)

# Run Luis analysis
result_sept = luis_three_way_analysis(temm_sept, adjusted_sept, total_sept, 'September 2023')

# Validate against Luis's results
print('\n' + '=' * 100)
print('VALIDATION: AUTOMATED vs LUIS\'S HAND-DONE AUDIT')
print('=' * 100)

luis_sept_temm = 6281
luis_sept_total = 9790
luis_sept_adjusted = 3869
luis_sept_missing = 400
luis_sept_adjusted_in_temm = 41

print(f'\n📊 Telefónica TEMM Count:')
print(f'   Luis: {luis_sept_temm:,} | Automated: {result_sept["temm_count"]:,} | Match: {abs(result_sept["temm_count"] - luis_sept_temm) <= 10}')

print(f'\n📊 Latcom Total Count:')
print(f'   Luis: {luis_sept_total:,} | Automated: {result_sept["total_count"]:,} | Match: {abs(result_sept["total_count"] - luis_sept_total) <= 10}')

print(f'\n📊 Latcom Adjusted Count:')
print(f'   Luis: {luis_sept_adjusted:,} | Automated: {result_sept["adjusted_count"]:,} | Match: {abs(result_sept["adjusted_count"] - luis_sept_adjusted) <= 10}')

print(f'\n📊 Missing from Our System:')
print(f'   Luis: ~{luis_sept_missing:,} | Automated: {result_sept["temm_not_in_total"]:,} | Match: {abs(result_sept["temm_not_in_total"] - luis_sept_missing) <= 50}')

print(f'\n📊 Adjusted in TEMM:')
print(f'   Luis: {luis_sept_adjusted_in_temm:,} | Automated: {result_sept["adjusted_in_temm"]:,} | Match: {abs(result_sept["adjusted_in_temm"] - luis_sept_adjusted_in_temm) <= 5}')

if result_sept['luis_pattern_detected']:
    print('\n✅ LUIS PATTERN CONFIRMED FOR SEPTEMBER!')
else:
    print('\n⚠️  Pattern detection mismatch')

# ============================================================================
# OCTOBER 2024 ANALYSIS
# ============================================================================
print('\n\n')
print('╔' + '═' * 98 + '╗')
print('║' + ' ' * 31 + 'OCTOBER 2023 AUDIT' + ' ' * 49 + '║')
print('╚' + '═' * 98 + '╝')

print('\n📋 Luis\'s Hand-Done Results for October 2023:')
print('   Telefónica: 7,368 trx, $92k')
print('   Latcom Total: 11,147 trx, $137k')
print('   Latcom Adjusted: 3,731 trx, $46k')
print('   Key finding: Only 43 adjusted transactions in TEMM (practically none)')
print('   Missing from our system: ~97 transactions')

# Extract October data
temm_oct = extract_month_from_temm(TEMM_FILE, 2023, 10)
adjusted_oct, total_oct = extract_sheets_from_latcom(
    OCT_FILE,
    'ADJUSTED',
    'PAQUETES OCTUBRE23'
)

# Run Luis analysis
result_oct = luis_three_way_analysis(temm_oct, adjusted_oct, total_oct, 'October 2023')

# Validate against Luis's results
print('\n' + '=' * 100)
print('VALIDATION: AUTOMATED vs LUIS\'S HAND-DONE AUDIT')
print('=' * 100)

luis_oct_temm = 7368
luis_oct_total = 11147
luis_oct_adjusted = 3731
luis_oct_missing = 97
luis_oct_adjusted_in_temm = 43

print(f'\n📊 Telefónica TEMM Count:')
print(f'   Luis: {luis_oct_temm:,} | Automated: {result_oct["temm_count"]:,} | Match: {abs(result_oct["temm_count"] - luis_oct_temm) <= 10}')

print(f'\n📊 Latcom Total Count:')
print(f'   Luis: {luis_oct_total:,} | Automated: {result_oct["total_count"]:,} | Match: {abs(result_oct["total_count"] - luis_oct_total) <= 10}')

print(f'\n📊 Latcom Adjusted Count:')
print(f'   Luis: {luis_oct_adjusted:,} | Automated: {result_oct["adjusted_count"]:,} | Match: {abs(result_oct["adjusted_count"] - luis_oct_adjusted) <= 10}')

print(f'\n📊 Missing from Our System:')
print(f'   Luis: ~{luis_oct_missing:,} | Automated: {result_oct["temm_not_in_total"]:,} | Match: {abs(result_oct["temm_not_in_total"] - luis_oct_missing) <= 50}')

print(f'\n📊 Adjusted in TEMM:')
print(f'   Luis: {luis_oct_adjusted_in_temm:,} | Automated: {result_oct["adjusted_in_temm"]:,} | Match: {abs(result_oct["adjusted_in_temm"] - luis_oct_adjusted_in_temm) <= 5}')

if result_oct['luis_pattern_detected']:
    print('\n✅ LUIS PATTERN CONFIRMED FOR OCTOBER!')
else:
    print('\n⚠️  Pattern detection mismatch')

# ============================================================================
# FINAL VALIDATION
# ============================================================================
print('\n\n')
print('╔' + '═' * 98 + '╗')
print('║' + ' ' * 35 + 'FINAL VALIDATION' + ' ' * 47 + '║')
print('╚' + '═' * 98 + '╝')

sept_match = (
    abs(result_sept["temm_count"] - luis_sept_temm) <= 10 and
    abs(result_sept["total_count"] - luis_sept_total) <= 10 and
    abs(result_sept["adjusted_count"] - luis_sept_adjusted) <= 10 and
    abs(result_sept["adjusted_in_temm"] - luis_sept_adjusted_in_temm) <= 5
)

oct_match = (
    abs(result_oct["temm_count"] - luis_oct_temm) <= 10 and
    abs(result_oct["total_count"] - luis_oct_total) <= 10 and
    abs(result_oct["adjusted_count"] - luis_oct_adjusted) <= 10 and
    abs(result_oct["adjusted_in_temm"] - luis_oct_adjusted_in_temm) <= 5
)

print(f'\n✅ September 2023 Validation: {"PASS" if sept_match else "FAIL"}')
print(f'✅ October 2023 Validation: {"PASS" if oct_match else "FAIL"}')

if sept_match and oct_match:
    print('\n🎉 SUCCESS! Automated methodology matches Luis\'s hand-done audit!')
    print('   The script can now be used for month-to-month analysis.')
else:
    print('\n⚠️  WARNING: Some discrepancies detected - review logic')

print('\n' + '=' * 100)
