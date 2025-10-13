#!/usr/bin/env python3
"""
Analyze NOT FOUND transactions to find patterns
Look for specific months/years with high missing counts
"""

import pandas as pd
import numpy as np
from datetime import datetime

print("=" * 80)
print("🔍 ANALYZING NOT FOUND TRANSACTIONS")
print("=" * 80)

# Load the NOT FOUND report
not_found_file = "/Users/richardmas/latcom-fix/reconciliation_reports/ENHANCED_NOT_FOUND_20251010_100900.csv"

print(f"\n📂 Loading: {not_found_file}")
df = pd.read_csv(not_found_file)

print(f"   ✅ Loaded {len(df):,} NOT FOUND transactions")
print(f"   Total USD: ${df['AMOUNT'].sum():,.2f}")

# Parse dates
df['DATE'] = pd.to_datetime(df['DATE'], errors='coerce', format='%d/%m/%Y')

# Extract year and month
df['YEAR'] = df['DATE'].dt.year
df['MONTH'] = df['DATE'].dt.month
df['YEAR_MONTH'] = df['DATE'].dt.to_period('M')

# Remove rows with no date
df_with_dates = df[df['DATE'].notna()].copy()
df_no_dates = df[df['DATE'].isna()].copy()

print(f"\n   Transactions with dates: {len(df_with_dates):,}")
print(f"   Transactions without dates: {len(df_no_dates):,}")

# ============================================
# Analysis by Year
# ============================================
print("\n" + "=" * 80)
print("📅 BREAKDOWN BY YEAR")
print("=" * 80)

year_analysis = df_with_dates.groupby('YEAR').agg({
    'AMOUNT': ['count', 'sum']
}).round(2)

print("\nYear    | Transactions | Total USD")
print("--------|--------------|----------------")
for year in sorted(df_with_dates['YEAR'].dropna().unique()):
    count = len(df_with_dates[df_with_dates['YEAR'] == year])
    total = df_with_dates[df_with_dates['YEAR'] == year]['AMOUNT'].sum()
    pct = (count / len(df_with_dates)) * 100
    print(f"{int(year)}    | {count:>12,} | ${total:>14,.2f} ({pct:>5.1f}%)")

# ============================================
# Analysis by Month (Top 20)
# ============================================
print("\n" + "=" * 80)
print("📅 TOP 20 MONTHS WITH MOST MISSING TRANSACTIONS")
print("=" * 80)

month_analysis = df_with_dates.groupby('YEAR_MONTH').agg({
    'AMOUNT': ['count', 'sum']
}).round(2)

month_analysis.columns = ['COUNT', 'TOTAL_USD']
month_analysis = month_analysis.sort_values('COUNT', ascending=False)

print("\nYear-Month | Transactions | Total USD       | % of Total")
print("-----------|--------------|-----------------|----------")

for idx, (period, row) in enumerate(month_analysis.head(20).iterrows()):
    count = int(row['COUNT'])
    total = row['TOTAL_USD']
    pct = (count / len(df_with_dates)) * 100
    print(f"{str(period):<10} | {count:>12,} | ${total:>14,.2f} | {pct:>5.1f}%")

# ============================================
# Analysis by Quarter
# ============================================
print("\n" + "=" * 80)
print("📅 BREAKDOWN BY QUARTER")
print("=" * 80)

df_with_dates['QUARTER'] = df_with_dates['DATE'].dt.to_period('Q')

quarter_analysis = df_with_dates.groupby('QUARTER').agg({
    'AMOUNT': ['count', 'sum']
}).round(2)

print("\nQuarter    | Transactions | Total USD")
print("-----------|--------------|----------------")
for quarter in sorted(df_with_dates['QUARTER'].dropna().unique()):
    count = len(df_with_dates[df_with_dates['QUARTER'] == quarter])
    total = df_with_dates[df_with_dates['QUARTER'] == quarter]['AMOUNT'].sum()
    pct = (count / len(df_with_dates)) * 100
    print(f"{str(quarter):<10} | {count:>12,} | ${total:>14,.2f} ({pct:>5.1f}%)")

# ============================================
# Find Anomalies
# ============================================
print("\n" + "=" * 80)
print("🚨 ANOMALY DETECTION")
print("=" * 80)

# Calculate average transactions per month
avg_per_month = len(df_with_dates) / len(df_with_dates['YEAR_MONTH'].unique())

print(f"\nAverage transactions per month: {avg_per_month:,.0f}")
print(f"\nMonths with MORE than 2x average ({avg_per_month*2:,.0f}):")

anomaly_months = month_analysis[month_analysis['COUNT'] > avg_per_month * 2]
for period, row in anomaly_months.iterrows():
    count = int(row['COUNT'])
    total = row['TOTAL_USD']
    multiplier = count / avg_per_month
    print(f"   {period}: {count:,} transactions (${total:,.2f}) - {multiplier:.1f}x average ⚠️")

# ============================================
# Detailed Analysis of Top Month
# ============================================
if len(month_analysis) > 0:
    top_month = month_analysis.index[0]
    top_month_data = df_with_dates[df_with_dates['YEAR_MONTH'] == top_month]

    print("\n" + "=" * 80)
    print(f"🔍 DETAILED ANALYSIS OF TOP MONTH: {top_month}")
    print("=" * 80)

    print(f"\nTotal transactions: {len(top_month_data):,}")
    print(f"Total USD: ${top_month_data['AMOUNT'].sum():,.2f}")

    print(f"\nAmount distribution:")
    print(f"   Min:    ${top_month_data['AMOUNT'].min():.2f}")
    print(f"   Max:    ${top_month_data['AMOUNT'].max():.2f}")
    print(f"   Mean:   ${top_month_data['AMOUNT'].mean():.2f}")
    print(f"   Median: ${top_month_data['AMOUNT'].median():.2f}")

    print(f"\nTop 10 most common amounts:")
    for amount, count in top_month_data['AMOUNT'].value_counts().head(10).items():
        pct = (count / len(top_month_data)) * 100
        print(f"   ${amount:.2f}: {count:,} transactions ({pct:.1f}%)")

    # Check if there's a product pattern
    if 'Product' in top_month_data.columns and top_month_data['Product'].notna().any():
        print(f"\nTop products in {top_month}:")
        for product, count in top_month_data['Product'].value_counts().head(5).items():
            print(f"   {product}: {count:,} transactions")

# ============================================
# Check for data gaps
# ============================================
print("\n" + "=" * 80)
print("📊 DATA CONTINUITY CHECK")
print("=" * 80)

# Get date range
min_date = df_with_dates['DATE'].min()
max_date = df_with_dates['DATE'].max()

print(f"\nDate range: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")

# Create list of all months in range
all_months = pd.period_range(start=min_date, end=max_date, freq='M')
present_months = set(df_with_dates['YEAR_MONTH'].dropna().unique())

missing_months = [m for m in all_months if m not in present_months]

if missing_months:
    print(f"\n⚠️  Months with ZERO NOT FOUND transactions (data gap?):")
    for month in missing_months:
        print(f"   {month}")
else:
    print(f"\n✅ All months have at least some NOT FOUND transactions")

# ============================================
# Summary and Recommendations
# ============================================
print("\n" + "=" * 80)
print("💡 KEY FINDINGS & RECOMMENDATIONS")
print("=" * 80)

# Find the year with most missing
year_counts = df_with_dates.groupby('YEAR')['AMOUNT'].count().sort_values(ascending=False)
top_year = year_counts.index[0]
top_year_count = year_counts.iloc[0]
top_year_pct = (top_year_count / len(df_with_dates)) * 100

print(f"\n1. 📅 MOST PROBLEMATIC YEAR:")
print(f"   Year {int(top_year)}: {top_year_count:,} missing transactions ({top_year_pct:.1f}%)")

# Find the month with most missing
top_month = month_analysis.index[0]
top_month_count = int(month_analysis.iloc[0]['COUNT'])
top_month_pct = (top_month_count / len(df_with_dates)) * 100

print(f"\n2. 📅 MOST PROBLEMATIC MONTH:")
print(f"   {top_month}: {top_month_count:,} missing transactions ({top_month_pct:.1f}%)")

# Check if there's a concentration
top_3_months = month_analysis.head(3)['COUNT'].sum()
top_3_pct = (top_3_months / len(df_with_dates)) * 100

print(f"\n3. 📊 CONCENTRATION:")
print(f"   Top 3 months contain: {int(top_3_months):,} transactions ({top_3_pct:.1f}%)")

if top_3_pct > 50:
    print(f"   ⚠️  MORE than 50% concentrated in just 3 months!")
    print(f"   → Suggests a specific data issue or event")

print(f"\n4. 💡 RECOMMENDATIONS:")

if top_year_pct > 70:
    print(f"   → Focus dispute on year {int(top_year)} ({top_year_pct:.0f}% of missing)")

if top_month_pct > 20:
    print(f"   → Investigate what happened in {top_month} ({top_month_pct:.0f}% missing)")

if len(df_no_dates) > 1000:
    print(f"   → {len(df_no_dates):,} transactions have NO DATE - verify operator data quality")

print("\n" + "=" * 80)

# Save detailed breakdown
output_file = "/Users/richardmas/latcom-fix/reconciliation_reports/NOT_FOUND_TEMPORAL_ANALYSIS.csv"
monthly_detail = df_with_dates.groupby('YEAR_MONTH').agg({
    'AMOUNT': ['count', 'sum', 'mean', 'median', 'min', 'max']
}).round(2)

monthly_detail.columns = ['COUNT', 'TOTAL_USD', 'AVG_USD', 'MEDIAN_USD', 'MIN_USD', 'MAX_USD']
monthly_detail.to_csv(output_file)

print(f"\n💾 Detailed monthly breakdown saved to:")
print(f"   {output_file}")

print("\n" + "=" * 80)
