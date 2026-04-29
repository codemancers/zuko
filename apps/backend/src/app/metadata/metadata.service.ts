import { Injectable } from '@nestjs/common';
import { DEAL_STAGES, DEAL_PRIORITIES, TASK_STATUSES } from '@zuko/sales';

export interface Currency {
  code: string;
  symbol: string;
  label: string;
  name: string;
}

export interface DealPriority {
  value: number;
  label: string;
}

export interface DealStage {
  value: string;
  label: string;
}

export interface TaskStatus {
  value: string;
  label: string;
}

@Injectable()
export class MetadataService {
  private cachedCurrencies: Currency[] | null = null;

  getCurrencies(): Currency[] {
    if (this.cachedCurrencies) {
      return this.cachedCurrencies;
    }

    // Modern Intl API to get all supported ISO 4217 currency codes
    const currencyCodes = (Intl as any).supportedValuesOf?.('currency') || [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'INR',
      'CAD',
      'AUD',
      'CHF',
      'CNY',
      'ZAR',
      'BRL',
    ];

    const displayNames = new Intl.DisplayNames(['en-US'], { type: 'currency' });

    const currencies = currencyCodes.map((code: string) => {
      let symbol = code;
      try {
        const parts = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: code,
        }).formatToParts(0);
        symbol = parts.find((p) => p.type === 'currency')?.value || code;
      } catch (e) {
        // Fallback for codes that NumberFormat might not handle
      }

      const name = displayNames.of(code) || code;

      return {
        code,
        symbol,
        name,
        label: `${code} (${symbol})`,
      };
    });

    this.cachedCurrencies = currencies;
    return currencies;
  }

  getDealPriorities(): DealPriority[] {
    return DEAL_PRIORITIES.map((p) => ({ value: p.value, label: p.label }));
  }

  getDealStages(): DealStage[] {
    return DEAL_STAGES.map((s) => ({ value: s.value, label: s.label }));
  }

  getTaskStatuses(): TaskStatus[] {
    return TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  }
}
