"""
Run Luis Audit for All Months (2023 and 2024)
Generate Excel reports and comprehensive summary
"""

import pandas as pd
import os
from datetime import datetime
import importlib.util

# Import the Luis analysis function
spec = importlib.util.spec_from_file_location("luis_audit", "/Users/richardmas/latcom-fix/luis-automated-monthly-audit.py")
luis_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(luis_audit)
luis_three_way_analysis = luis_audit.luis_three_way_analysis
clean_transaction_id = luis_audit.clean_transaction_id

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Registros_TEMM_NoSoporteActual_202309_202412.csv'
BASE_2023 = '/Users/richardmas/Downloads/2023 FINAL'
BASE_2024 = '/Users/richardmas/Downloads/2024 FINAL'
OUTPUT_DIR = '/Users/richardmas/latcom-fix/new full audit 2023 and 2024'

# Month configurations
months_2023 = {
    9: {'name': 'September', 'file': 'FINAL SEPTIEMBRE 20231.xlsx', 'sheet': 'PAQUETES SEPTIEMBRE23'},
    10: {'name': 'October', 'file': 'FINAL OCTUBRE 20231.xlsx', 'sheet': 'PAQUETES OCTUBRE23'},
    11: {'name': 'November', 'file': 'FINAL NOVIEMBRE 2023.xlsx', 'sheet': 'PAQUETES NOVIEMBRE23'},
    12: {'name': 'December', 'file': 'FINAL DICIEMBRE 2023.xlsx', 'sheet': 'PAQUETES DICIEMBRE23'}
}

months_2024 = {
    1: {'name': 'January', 'file': 'ENERO 2024.xlsx', 'sheet': 'PAQUETES ENERO24'},
    2: {'name': 'February', 'file': 'FEBRERO 2024.xlsx', 'sheet': 'PAQUETES FEB24'},
    3: {'name': 'March', 'file': 'MARZO 2024.xlsx', 'sheet': 'PAQUETES MARZO24'},
    4: {'name': 'April', 'file': 'ABRIL 2024.xlsx', 'sheet': 'PAQUETES ABRIL24'},
    5: {'name': 'May', 'file': 'MAYO 2024.xlsx', 'sheet': 'PAQUETES MAYO24'},
    6: {'name': 'June', 'file': 'JUNIO 2024.xlsx', 'sheet': 'PAQUETES JUNIO24'},
    7: {'name': 'July', 'file': 'JULIO 2024.xlsx', 'sheet': 'PAQUETES JULIO25'},
    8: {'name': 'August', 'file': 'AGOSTO 2024.xlsx', 'sheet': 'PAQUETES AGOSTO24'},
    9: {'name': 'September', 'file': 'SEPTIEMBRE 2024.xlsx', 'sheet': 'PAQUETES SEPTIEMBRE24'},
    10: {'name': 'October', 'file': 'OCTUBRE 2024.xlsx', 'sheet': 'PAQUETES OCTUBRE24'},
    11: {'name': 'November', 'file': 'NOVIEMBRE 2024.xlsx', 'sheet': 'PAQUETES NOV24'},
    12: {'name': 'December', 'file': 'DICIEMBRE 2024.xlsx', 'sheet': 'PAQUETES DICIEMBRE24'}
}

def extract_month_from_temm(temm_file, year, month_num):
    """Extract a specific month from the TEMM file"""
    df = pd.read_csv(temm_file, encoding='utf-8-sig')
    df['FECHA'] = pd.to_datetime(df['FECHA'], format='%d/%m/%Y')
    df['Year'] = df['FECHA'].dt.year
    df['Month'] = df['FECHA'].dt.month

    df_month = df[(df['Year'] == year) & (df['Month'] == month_num)].copy()

    temp_file = f'/tmp/temm_{year}_{month_num:02d}.csv'
    df_month.to_csv(temp_file, index=False)

    return temp_file, df_month

def extract_latcom_sheets(base_dir, file_name, total_sheet):
    """Extract sheets from Latcom Excel file"""
    file_path = f'{base_dir}/{file_name}'

    df_adjusted = pd.read_excel(file_path, sheet_name='ADJUSTED')
    df_total = pd.read_excel(file_path, sheet_name=total_sheet)

    temp_adjusted = f'/tmp/latcom_adjusted_{file_name}.csv'
    temp_total = f'/tmp/latcom_total_{file_name}.csv'

    df_adjusted.to_csv(temp_adjusted, index=False)
    df_total.to_csv(temp_total, index=False)

    return temp_adjusted, temp_total, df_adjusted, df_total

def create_month_excel(month_name, year, result, df_temm, df_adjusted, df_total, output_dir):
    """Create detailed Excel report for a single month"""

    output_file = f'{output_dir}/{year}/{month_name}_{year}_Luis_Audit.xlsx'

    with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
        workbook = writer.book

        # Formats
        header_fmt = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1,
            'align': 'center'
        })
        highlight_fmt = workbook.add_format({
            'bg_color': '#FFE699',
            'border': 1
        })
        success_fmt = workbook.add_format({
            'bg_color': '#C6EFCE',
            'font_color': '#006100',
            'border': 1
        })
        error_fmt = workbook.add_format({
            'bg_color': '#FFC7CE',
            'font_color': '#9C0006',
            'border': 1
        })

        # Summary Sheet
        summary_data = {
            'Metric': [
                'Dataset Sizes',
                'Telefónica TEMM Count',
                'Telefónica TEMM Amount (USD)',
                'Latcom Total Count',
                'Latcom Total Amount (USD)',
                'Latcom Adjusted Count',
                'Latcom Adjusted Amount (USD)',
                '',
                'Key Findings',
                'TEMM in Our Total',
                'TEMM NOT in Our Total (Missing)',
                'Missing Amount (USD)',
                'Adjusted in TEMM',
                'Adjusted NOT in TEMM (Excluded)',
                'Excluded Amount (USD)',
                'Match Rate (%)',
                '',
                'Luis Pattern',
                'Pattern Detected?',
                'Real Discrepancy (USD)',
                'Artificial Discrepancy (USD)'
            ],
            'Value': [
                '',
                result['temm_count'],
                f"${result['temm_usd']:,.2f}",
                result['total_count'],
                f"${result['total_usd']:,.2f}",
                result['adjusted_count'],
                f"${result['adjusted_usd']:,.2f}",
                '',
                '',
                result['temm_in_total'],
                result['temm_not_in_total'],
                f"${result['missing_usd']:,.2f}",
                result['adjusted_in_temm'],
                result['adjusted_not_in_temm'],
                f"${result['adjusted_not_in_temm_usd']:,.2f}",
                f"{result['match_rate_pct']:.2f}%",
                '',
                '',
                'YES' if result['luis_pattern_detected'] else 'NO',
                f"${result['missing_usd']:,.2f}",
                f"${result['adjusted_not_in_temm_usd']:,.2f}"
            ]
        }

        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

        worksheet = writer.sheets['SUMMARY']
        worksheet.set_column('A:A', 40)
        worksheet.set_column('B:B', 25)

        # TEMM Data
        df_temm_clean = clean_transaction_id(df_temm.copy(), 'SEC_ACTUACION')
        df_temm_clean[['FECHA', 'NUM_TELEFONO', 'SEC_ACTUACION', 'ImpUSD', 'SEC_ACTUACION_CLEAN']].to_excel(
            writer, sheet_name='TEMM_Telefonica', index=False
        )

        # Adjusted Data
        df_adjusted_clean = clean_transaction_id(df_adjusted.copy(), 'VENDOR_TRANSACTION_ID')
        df_adjusted_clean[['VENDOR_TRANSACTION_ID', 'TransactionAmountUSD', 'VENDOR_TRANSACTION_ID_CLEAN']].to_excel(
            writer, sheet_name='Adjusted_Latcom', index=False
        )

        # Total Data
        df_total_clean = clean_transaction_id(df_total.copy(), 'VENDOR_TRANSACTION_ID')
        df_total_clean[['VENDOR_TRANSACTION_ID', 'TransactionAmountUSD', 'VENDOR_TRANSACTION_ID_CLEAN']].to_excel(
            writer, sheet_name='Total_Latcom', index=False
        )

        # Missing from our system
        if result['temm_missing_ids']:
            df_missing = df_temm_clean[df_temm_clean['SEC_ACTUACION_CLEAN'].isin(result['temm_missing_ids'])]
            df_missing[['FECHA', 'NUM_TELEFONO', 'SEC_ACTUACION', 'ImpUSD']].to_excel(
                writer, sheet_name='Missing_From_Our_System', index=False
            )

        # Excluded by Telefonica
        if result['adjusted_excluded_ids']:
            df_excluded = df_adjusted_clean[df_adjusted_clean['VENDOR_TRANSACTION_ID_CLEAN'].isin(result['adjusted_excluded_ids'])]
            df_excluded[['VENDOR_TRANSACTION_ID', 'TransactionAmountUSD']].head(1000).to_excel(
                writer, sheet_name='Excluded_By_Telefonica', index=False
            )

    print(f'   ✅ Excel created: {output_file}')

# Main execution
print('=' * 120)
print('COMPLETE LUIS AUDIT: 2023-2024')
print('Running analysis for all months with Excel reports')
print('=' * 120)

all_results = []

# Process 2023 months
print('\n' + '═' * 120)
print('2023 ANALYSIS')
print('═' * 120)

for month_num, config in months_2023.items():
    month_name = config['name']
    print(f'\n{"─" * 120}')
    print(f'📅 {month_name} 2023')
    print('─' * 120)

    try:
        # Extract data
        temm_file, df_temm = extract_month_from_temm(TEMM_FILE, 2023, month_num)
        adjusted_file, total_file, df_adjusted, df_total = extract_latcom_sheets(
            BASE_2023, config['file'], config['sheet']
        )

        print(f'   TEMM: {len(df_temm):,} | Adjusted: {len(df_adjusted):,} | Total: {len(df_total):,}')

        # Run analysis (suppress detailed output)
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()

        result = luis_three_way_analysis(temm_file, adjusted_file, total_file, f'{month_name} 2023')

        sys.stdout = old_stdout

        # Add to results
        all_results.append(result)

        # Create Excel
        create_month_excel(month_name, 2023, result, df_temm, df_adjusted, df_total, OUTPUT_DIR)

        # Print summary
        print(f'   ✅ Pattern Detected: {result["luis_pattern_detected"]}')
        print(f'   💰 Real Issue: ${result["missing_usd"]:,.2f} | Artificial: ${result["adjusted_not_in_temm_usd"]:,.2f}')

    except Exception as e:
        print(f'   ❌ ERROR: {str(e)}')

# Process 2024 months
print('\n' + '═' * 120)
print('2024 ANALYSIS')
print('═' * 120)

for month_num, config in months_2024.items():
    month_name = config['name']
    print(f'\n{"─" * 120}')
    print(f'📅 {month_name} 2024')
    print('─' * 120)

    try:
        # Extract data
        temm_file, df_temm = extract_month_from_temm(TEMM_FILE, 2024, month_num)
        adjusted_file, total_file, df_adjusted, df_total = extract_latcom_sheets(
            BASE_2024, config['file'], config['sheet']
        )

        print(f'   TEMM: {len(df_temm):,} | Adjusted: {len(df_adjusted):,} | Total: {len(df_total):,}')

        # Run analysis (suppress detailed output)
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()

        result = luis_three_way_analysis(temm_file, adjusted_file, total_file, f'{month_name} 2024')

        sys.stdout = old_stdout

        # Add to results
        all_results.append(result)

        # Create Excel
        create_month_excel(month_name, 2024, result, df_temm, df_adjusted, df_total, OUTPUT_DIR)

        # Print summary
        print(f'   ✅ Pattern Detected: {result["luis_pattern_detected"]}')
        print(f'   💰 Real Issue: ${result["missing_usd"]:,.2f} | Artificial: ${result["adjusted_not_in_temm_usd"]:,.2f}')

    except Exception as e:
        print(f'   ❌ ERROR: {str(e)}')

print('\n' + '═' * 120)
print('CREATING MASTER SUMMARY')
print('═' * 120)

# Create master summary Excel
summary_output = f'{OUTPUT_DIR}/MASTER_SUMMARY_2023_2024.xlsx'

with pd.ExcelWriter(summary_output, engine='xlsxwriter') as writer:
    # All months summary
    summary_data = []
    for r in all_results:
        summary_data.append({
            'Month': r['month'],
            'TEMM_Count': r['temm_count'],
            'TEMM_USD': r['temm_usd'],
            'Total_Count': r['total_count'],
            'Total_USD': r['total_usd'],
            'Adjusted_Count': r['adjusted_count'],
            'Adjusted_USD': r['adjusted_usd'],
            'Missing_Count': r['temm_not_in_total'],
            'Missing_USD': r['missing_usd'],
            'Adjusted_In_TEMM': r['adjusted_in_temm'],
            'Adjusted_NOT_In_TEMM': r['adjusted_not_in_temm'],
            'Excluded_USD': r['adjusted_not_in_temm_usd'],
            'Match_Rate_%': round(r['match_rate_pct'], 2),
            'Pattern_Detected': 'YES' if r['luis_pattern_detected'] else 'NO'
        })

    df_master = pd.DataFrame(summary_data)
    df_master.to_excel(writer, sheet_name='All_Months', index=False)

    # Totals
    totals = {
        'Metric': ['Total TEMM', 'Total Adjusted', 'Total Missing', 'Total Excluded'],
        'Count': [
            df_master['TEMM_Count'].sum(),
            df_master['Adjusted_Count'].sum(),
            df_master['Missing_Count'].sum(),
            df_master['Adjusted_NOT_In_TEMM'].sum()
        ],
        'Amount_USD': [
            df_master['TEMM_USD'].sum(),
            df_master['Adjusted_USD'].sum(),
            df_master['Missing_USD'].sum(),
            df_master['Excluded_USD'].sum()
        ]
    }

    pd.DataFrame(totals).to_excel(writer, sheet_name='Totals', index=False)

print(f'✅ Master summary created: {summary_output}')

print('\n' + '═' * 120)
print('COMPLETE!')
print('═' * 120)
print(f'\n📁 All reports saved to: {OUTPUT_DIR}')
print(f'   - {len([r for r in all_results if "2023" in r["month"]])} months in 2023/')
print(f'   - {len([r for r in all_results if "2024" in r["month"]])} months in 2024/')
print(f'   - Master summary: MASTER_SUMMARY_2023_2024.xlsx')
