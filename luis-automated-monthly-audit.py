"""
Automated Luis-Style Monthly Audit Script
Replicates Luis's hand-done methodology for monthly Telefónica reconciliation

Usage:
    python luis-automated-monthly-audit.py <temm_file> <latcom_adjusted_file> <latcom_total_file> <month_name>

Example:
    python luis-automated-monthly-audit.py temm_oct.csv adjusted_oct.csv total_oct.csv "October 2024"
"""

import pandas as pd
import sys
from datetime import datetime

def clean_transaction_id(df, column_name):
    """Clean transaction IDs by removing decimals and whitespace"""
    df[f'{column_name}_CLEAN'] = df[column_name].astype(str).str.split('.').str[0].str.strip()
    return df

def luis_three_way_analysis(temm_file, adjusted_file, total_file, month_name):
    """
    Perform Luis's three-way cross-reference analysis

    Luis's Methodology:
    1. Check if Telefónica transactions are in our system (TEMM vs Total)
    2. Check if our adjusted transactions are in Telefónica (Adjusted vs TEMM)
    3. Verify internal consistency (Adjusted vs Total)
    """

    print('=' * 100)
    print(f'LUIS-STYLE AUDIT: {month_name}')
    print('=' * 100)

    # 1. Load TEMM file (Telefónica)
    print('\n📦 Loading Telefónica TEMM file...')
    try:
        df_temm = pd.read_csv(temm_file, encoding='utf-8-sig')
    except:
        df_temm = pd.read_csv(temm_file, encoding='latin1')

    df_temm = clean_transaction_id(df_temm, 'SEC_ACTUACION')
    temm_count = len(df_temm)
    temm_usd = df_temm['ImpUSD'].sum()

    print(f'   Telefónica: {temm_count:,} transactions, ${temm_usd:,.0f}')

    # 2. Load Latcom Total (all real data)
    print('\n📦 Loading Latcom Total (real data)...')
    try:
        df_total = pd.read_csv(total_file, encoding='utf-8-sig')
    except:
        try:
            df_total = pd.read_excel(total_file)
        except:
            df_total = pd.read_csv(total_file, encoding='latin1')

    df_total = clean_transaction_id(df_total, 'VENDOR_TRANSACTION_ID')
    total_count = len(df_total)
    total_usd = df_total['TransactionAmountUSD'].sum()

    print(f'   Latcom Total: {total_count:,} transactions, ${total_usd:,.0f}')

    # 3. Load Latcom Adjusted (filtered successful transactions)
    print('\n📦 Loading Latcom Adjusted (reported data)...')
    try:
        df_adjusted = pd.read_csv(adjusted_file, encoding='utf-8-sig')
    except:
        try:
            df_adjusted = pd.read_excel(adjusted_file)
        except:
            df_adjusted = pd.read_csv(adjusted_file, encoding='latin1')

    df_adjusted = clean_transaction_id(df_adjusted, 'VENDOR_TRANSACTION_ID')
    adjusted_count = len(df_adjusted)
    adjusted_usd = df_adjusted['TransactionAmountUSD'].sum()

    print(f'   Latcom Adjusted: {adjusted_count:,} transactions, ${adjusted_usd:,.0f}')

    # Create ID sets for comparison
    temm_ids = set(df_temm['SEC_ACTUACION_CLEAN'])
    total_ids = set(df_total['VENDOR_TRANSACTION_ID_CLEAN'])
    adjusted_ids = set(df_adjusted['VENDOR_TRANSACTION_ID_CLEAN'])

    print('\n' + '=' * 100)
    print('LUIS METHODOLOGY: THREE-WAY CROSS-REFERENCE')
    print('=' * 100)

    # ANALYSIS 1: TEMM vs Total (Are Telefónica's claims in our system?)
    print('\n🔍 1️⃣  TELEFÓNICA vs LATCOM TOTAL:')
    print('   Question: Are Telefónica\'s claimed transactions in our system?')

    temm_in_total = temm_ids & total_ids
    temm_not_in_total = temm_ids - total_ids

    temm_in_total_pct = (len(temm_in_total) / temm_count * 100) if temm_count > 0 else 0

    print(f'\n   ✅ TEMM found in Total:     {len(temm_in_total):,} ({temm_in_total_pct:.1f}%)')
    print(f'   ❌ TEMM NOT in Total:       {len(temm_not_in_total):,} (MISSING FROM OUR SYSTEM)')

    # Calculate amount missing
    df_temm_missing = df_temm[df_temm['SEC_ACTUACION_CLEAN'].isin(temm_not_in_total)]
    missing_usd = df_temm_missing['ImpUSD'].sum()

    print(f'      💰 Missing amount: ${missing_usd:,.2f}')

    # ANALYSIS 2: Adjusted vs Total (Internal consistency check)
    print('\n🔍 2️⃣  LATCOM ADJUSTED vs LATCOM TOTAL:')
    print('   Question: Are our adjusted transactions in our total data?')

    adjusted_in_total = adjusted_ids & total_ids
    adjusted_not_in_total = adjusted_ids - total_ids

    adjusted_in_total_pct = (len(adjusted_in_total) / adjusted_count * 100) if adjusted_count > 0 else 0

    print(f'\n   ✅ Adjusted in Total:       {len(adjusted_in_total):,} ({adjusted_in_total_pct:.1f}%)')
    print(f'   ❌ Adjusted NOT in Total:   {len(adjusted_not_in_total):,} (ID ERRORS)')

    # ANALYSIS 3: Adjusted vs TEMM (THE KEY FINDING - Luis Pattern)
    print('\n🔍 3️⃣  LATCOM ADJUSTED vs TELEFÓNICA TEMM: ⚠️  KEY FINDING')
    print('   Question: Are our successful adjusted transactions in Telefónica\'s list?')

    adjusted_in_temm = adjusted_ids & temm_ids
    adjusted_not_in_temm = adjusted_ids - temm_ids

    adjusted_in_temm_pct = (len(adjusted_in_temm) / adjusted_count * 100) if adjusted_count > 0 else 0
    adjusted_not_in_temm_pct = (len(adjusted_not_in_temm) / adjusted_count * 100) if adjusted_count > 0 else 0

    print(f'\n   ✅ Adjusted in TEMM:        {len(adjusted_in_temm):,} ({adjusted_in_temm_pct:.2f}%)')
    print(f'   ❌ Adjusted NOT in TEMM:    {len(adjusted_not_in_temm):,} ({adjusted_not_in_temm_pct:.2f}%)')

    # Calculate amounts
    df_adjusted_in_temm = df_adjusted[df_adjusted['VENDOR_TRANSACTION_ID_CLEAN'].isin(adjusted_in_temm)]
    df_adjusted_not_in_temm = df_adjusted[df_adjusted['VENDOR_TRANSACTION_ID_CLEAN'].isin(adjusted_not_in_temm)]

    adjusted_in_temm_usd = df_adjusted_in_temm['TransactionAmountUSD'].sum()
    adjusted_not_in_temm_usd = df_adjusted_not_in_temm['TransactionAmountUSD'].sum()

    print(f'      💰 Amount in TEMM: ${adjusted_in_temm_usd:,.2f}')
    print(f'      💰 Amount NOT in TEMM: ${adjusted_not_in_temm_usd:,.2f}')

    # ANALYSIS 4: Empirical observation (Latcom Total ≈ TEMM + Adjusted?)
    print('\n🔍 4️⃣  EMPIRICAL OBSERVATION (Luis\'s Note):')
    print('   Question: Does Latcom Total ≈ Telefónica + Latcom Adjusted?')

    empirical_sum = temm_count + adjusted_count
    empirical_diff = abs(total_count - empirical_sum)
    empirical_diff_pct = (empirical_diff / total_count * 100) if total_count > 0 else 0

    print(f'\n   Latcom Total:              {total_count:,} transactions')
    print(f'   TEMM + Adjusted:           {empirical_sum:,} transactions')
    print(f'   Difference:                {empirical_diff:,} ({empirical_diff_pct:.1f}%)')

    if empirical_diff_pct < 5:
        print(f'   ✅ CONFIRMED: Total ≈ TEMM + Adjusted')
    else:
        print(f'   ⚠️  Pattern does not match Luis\'s observation')

    # LUIS PATTERN DETECTION
    print('\n' + '=' * 100)
    print('LUIS PATTERN DETECTION')
    print('=' * 100)

    if adjusted_not_in_temm_pct > 95:
        print('\n⚠️  🚨 LUIS PATTERN DETECTED! 🚨')
        print(f'\n   {len(adjusted_not_in_temm):,} adjusted transactions ({adjusted_not_in_temm_pct:.1f}%) NOT in Telefónica TEMM')
        print(f'   Amount excluded: ${adjusted_not_in_temm_usd:,.2f}')
        print('\n   This indicates TEMM file is PRE-FILTERED by Telefónica!')
        print('   They have already removed our successful/adjusted transactions.')
    else:
        print('\n✅ Pattern does not match - normal reconciliation scenario')

    # Check for retry pattern (Luis's observation about no duplicates)
    print('\n🔍 5️⃣  RETRY PATTERN CHECK (Luis\'s Note):')
    print('   Question: Are there duplicate phone numbers in TEMM (indicating retries)?')

    duplicate_phones = df_temm['NUM_TELEFONO'].duplicated().sum()
    duplicate_pct = (duplicate_phones / temm_count * 100) if temm_count > 0 else 0

    print(f'\n   Duplicate phones in TEMM:  {duplicate_phones:,} ({duplicate_pct:.1f}%)')

    if duplicate_pct < 5:
        print('   ✅ CONFIRMED: No retries in TEMM (typical of pre-filtered data)')
    else:
        print('   ⚠️  Normal retry pattern detected')

    # FINAL SUMMARY
    print('\n' + '=' * 100)
    print('FINAL SUMMARY')
    print('=' * 100)

    print(f'\n📊 Dataset Sizes:')
    print(f'   Telefónica TEMM:    {temm_count:,} trx, ${temm_usd:,.0f}')
    print(f'   Latcom Total:       {total_count:,} trx, ${total_usd:,.0f}')
    print(f'   Latcom Adjusted:    {adjusted_count:,} trx, ${adjusted_usd:,.0f}')

    print(f'\n🎯 Key Findings (Luis Methodology):')
    print(f'   1. Missing from our system:     {len(temm_not_in_total):,} trx → ${missing_usd:,.2f}')
    print(f'   2. Adjusted in TEMM:            {len(adjusted_in_temm):,} trx ({adjusted_in_temm_pct:.2f}%)')
    print(f'   3. Adjusted NOT in TEMM:        {len(adjusted_not_in_temm):,} trx ({adjusted_not_in_temm_pct:.2f}%)')
    print(f'   4. Amount excluded from TEMM:   ${adjusted_not_in_temm_usd:,.2f}')

    print(f'\n💡 Conclusion:')
    if adjusted_not_in_temm_pct > 95:
        print(f'   ⚠️  LUIS PATTERN CONFIRMED!')
        print(f'   Real discrepancy: ${missing_usd:,.2f} (transactions missing from our system)')
        print(f'   Artificial discrepancy: ${adjusted_not_in_temm_usd:,.2f} (excluded by Telefónica)')
    else:
        print(f'   ✅ Normal reconciliation - no pre-filtering detected')

    print('\n' + '=' * 100)

    # Return results for programmatic use
    return {
        'month': month_name,
        'temm_count': temm_count,
        'temm_usd': temm_usd,
        'total_count': total_count,
        'total_usd': total_usd,
        'adjusted_count': adjusted_count,
        'adjusted_usd': adjusted_usd,
        'temm_in_total': len(temm_in_total),
        'temm_not_in_total': len(temm_not_in_total),
        'missing_usd': missing_usd,
        'adjusted_in_temm': len(adjusted_in_temm),
        'adjusted_not_in_temm': len(adjusted_not_in_temm),
        'adjusted_in_temm_usd': adjusted_in_temm_usd,
        'adjusted_not_in_temm_usd': adjusted_not_in_temm_usd,
        'match_rate_pct': adjusted_in_temm_pct,
        'luis_pattern_detected': adjusted_not_in_temm_pct > 95,
        'duplicate_phones': duplicate_phones,
        'temm_missing_ids': list(temm_not_in_total),
        'adjusted_excluded_ids': list(adjusted_not_in_temm)
    }

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print(__doc__)
        print('\n❌ ERROR: Missing arguments')
        print('\nRequired arguments:')
        print('  1. TEMM file (Telefónica CSV)')
        print('  2. Latcom Adjusted file (CSV/Excel)')
        print('  3. Latcom Total file (CSV/Excel)')
        print('  4. Month name (e.g., "October 2024")')
        sys.exit(1)

    temm_file = sys.argv[1]
    adjusted_file = sys.argv[2]
    total_file = sys.argv[3]
    month_name = sys.argv[4]

    result = luis_three_way_analysis(temm_file, adjusted_file, total_file, month_name)

    print('\n✅ Analysis complete!')
    print(f'   Luis Pattern Detected: {result["luis_pattern_detected"]}')
