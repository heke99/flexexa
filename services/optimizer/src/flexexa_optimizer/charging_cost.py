# SPDX-License-Identifier: AGPL-3.0-only
# Replaces the lumped BUY_FIXED_KR responsibility in EnergyWizard nordpool.py.
from dataclasses import dataclass
from decimal import Decimal,Context,localcontext,ROUND_HALF_EVEN

@dataclass(frozen=True)
class PriceComponents:
    # Explicit per-kWh values excluding VAT. No country tax defaults.
    market: Decimal
    retailer: Decimal
    grid_transfer: Decimal
    tax: Decimal
    vat_rate: Decimal
    currency: str = 'SEK'
    version: str = 'explicit-input'
    def validate(self):
        values=(self.market,self.retailer,self.grid_transfer,self.tax,self.vat_rate)
        if any(not isinstance(x,Decimal) or not x.is_finite() or abs(x)>Decimal('1000000') for x in values):raise ValueError('Finite bounded Decimal rates required')
        if self.grid_transfer<0 or self.tax<0 or not 0<=self.vat_rate<=1:raise ValueError('Invalid transfer/tax/VAT')
        if self.currency!='SEK' or not self.version:raise ValueError('Versioned SEK input required in this slice')
    def variable_rate(self):
        self.validate()
        with localcontext(Context(prec=28)):
            return (self.market+self.retailer+self.grid_transfer+self.tax)*(1+self.vat_rate)

def quote_energy(energy_kwh: Decimal, price: PriceComponents, *, peak_increment_ex_vat: Decimal | None=None) -> dict:
    price.validate()
    if not isinstance(energy_kwh,Decimal) or not energy_kwh.is_finite() or not 0<=energy_kwh<=1000000:raise ValueError('Bounded nonnegative energy required')
    if peak_increment_ex_vat is not None and (not isinstance(peak_increment_ex_vat,Decimal) or not peak_increment_ex_vat.is_finite() or peak_increment_ex_vat<0):raise ValueError('Explicit nonnegative peak increment required')
    with localcontext(Context(prec=28,rounding=ROUND_HALF_EVEN)):
        def gross(rate):return (energy_kwh*rate*(1+price.vat_rate)).quantize(Decimal('.01'))
        rows={'market':gross(price.market),'retailer':gross(price.retailer),'grid_transfer':gross(price.grid_transfer),'tax':gross(price.tax)}
        variable=sum(rows.values(),Decimal(0))
        peak=None if peak_increment_ex_vat is None else (peak_increment_ex_vat*(1+price.vat_rate)).quantize(Decimal('.01'))
        return {'currency':price.currency,'price_version':price.version,'amount_basis':'estimated_including_vat','components':rows,'electricity':rows['market']+rows['retailer'],'variable_total':variable,'peak_increment':peak,'total':None if peak is None else variable+peak,'total_complete':peak is not None,'fixed_fees_included':False}
