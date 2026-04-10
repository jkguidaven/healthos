/**
 * src/lib/external/__tests__/open-food-facts.test.ts
 *
 * Unit tests for the Open Food Facts client. We use MSW to intercept the
 * fetch call and feed back representative response shapes (found,
 * not-found, transport error, bad payload).
 */

import { http, HttpResponse } from 'msw'

import { setupMswServer } from '@/test-utils/msw-server-setup'
import { server } from '@/test-utils/msw-server'
import {
  BarcodeNetworkError,
  BarcodeNotFoundError,
  lookupBarcode,
} from '../open-food-facts'

const OFF_URL = /https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/.*/

describe('lookupBarcode', () => {
  setupMswServer()

  it('returns a normalised product when OFF has per-serving nutriments', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            product_name: 'Nutella',
            product_name_en: 'Nutella',
            brands: 'Ferrero,Nutella',
            serving_size: '15 g',
            code: '3017620422003',
            nutriments: {
              'energy-kcal_serving': 80,
              'energy-kcal_100g': 539,
              proteins_serving: 0.9,
              proteins_100g: 6.3,
              carbohydrates_serving: 8.6,
              carbohydrates_100g: 57.5,
              fat_serving: 4.6,
              fat_100g: 30.9,
            },
          },
        }),
      ),
    )

    const result = await lookupBarcode('3017620422003')

    expect(result.name).toBe('Nutella')
    expect(result.brand).toBe('Ferrero')
    expect(result.servingDescription).toBe('15 g')
    expect(result.calories).toBe(80)
    expect(result.proteinG).toBe(0.9)
    expect(result.carbsG).toBe(8.6)
    expect(result.fatG).toBe(4.6)
  })

  it('falls back to per-100g values when no per-serving data exists', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            product_name: 'Plain yogurt',
            brands: 'Brand A',
            nutriments: {
              'energy-kcal_100g': 60,
              proteins_100g: 3.5,
              carbohydrates_100g: 4.7,
              fat_100g: 3.3,
            },
          },
        }),
      ),
    )

    const result = await lookupBarcode('1234567890123')

    expect(result.name).toBe('Plain yogurt')
    expect(result.brand).toBe('Brand A')
    // No serving_size → default to "100 g"
    expect(result.servingDescription).toBe('100 g')
    expect(result.calories).toBe(60)
    expect(result.proteinG).toBe(3.5)
    expect(result.carbsG).toBe(4.7)
    expect(result.fatG).toBe(3.3)
  })

  it('zeroes out missing nutriments instead of throwing', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            product_name: 'Mystery snack',
            nutriments: {},
          },
        }),
      ),
    )

    const result = await lookupBarcode('0000000000000')

    expect(result.calories).toBe(0)
    expect(result.proteinG).toBe(0)
    expect(result.carbsG).toBe(0)
    expect(result.fatG).toBe(0)
    expect(result.brand).toBeNull()
  })

  it('rounds grams to one decimal and kcal to integer', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            product_name: 'Test',
            nutriments: {
              'energy-kcal_serving': 123.6,
              proteins_serving: 10.24,
              carbohydrates_serving: 3.57,
              fat_serving: 1.05,
            },
          },
        }),
      ),
    )

    const result = await lookupBarcode('9999999999999')

    expect(result.calories).toBe(124)
    expect(result.proteinG).toBe(10.2)
    expect(result.carbsG).toBe(3.6)
    expect(result.fatG).toBe(1.1)
  })

  it('prefers product_name_en over product_name when both exist', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            product_name: 'Céréales chocolatées',
            product_name_en: 'Chocolate cereals',
            nutriments: { 'energy-kcal_100g': 400 },
          },
        }),
      ),
    )

    const result = await lookupBarcode('5555555555555')
    expect(result.name).toBe('Chocolate cereals')
  })

  it('throws BarcodeNotFoundError when OFF returns status=0', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 0,
          status_verbose: 'product not found',
        }),
      ),
    )

    await expect(lookupBarcode('0000000000001')).rejects.toBeInstanceOf(
      BarcodeNotFoundError,
    )
  })

  it('throws BarcodeNotFoundError when the product object is missing', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          // No product field at all
        }),
      ),
    )

    await expect(lookupBarcode('0000000000002')).rejects.toBeInstanceOf(
      BarcodeNotFoundError,
    )
  })

  it('throws BarcodeNetworkError on non-2xx HTTP responses', async () => {
    server.use(
      http.get(
        OFF_URL,
        () => new HttpResponse(null, { status: 500 }),
      ),
    )

    await expect(lookupBarcode('1111111111111')).rejects.toBeInstanceOf(
      BarcodeNetworkError,
    )
  })

  it('throws BarcodeNetworkError when fetch itself rejects', async () => {
    server.use(
      http.get(OFF_URL, () => {
        return HttpResponse.error()
      }),
    )

    await expect(lookupBarcode('2222222222222')).rejects.toBeInstanceOf(
      BarcodeNetworkError,
    )
  })

  it('throws BarcodeNetworkError when the response shape is unexpected', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          // Missing required `status` field
          message: 'Something else entirely',
        }),
      ),
    )

    await expect(lookupBarcode('3333333333333')).rejects.toBeInstanceOf(
      BarcodeNetworkError,
    )
  })

  it('exposes the barcode on BarcodeNotFoundError', async () => {
    server.use(
      http.get(OFF_URL, () => HttpResponse.json({ status: 0 })),
    )

    try {
      await lookupBarcode('4444444444444')
      fail('expected lookupBarcode to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(BarcodeNotFoundError)
      if (error instanceof BarcodeNotFoundError) {
        expect(error.barcode).toBe('4444444444444')
        expect(error.code).toBe('not_found')
      }
    }
  })

  it('defaults name to "Unknown product" when OFF has no name fields', async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          status: 1,
          product: {
            nutriments: { 'energy-kcal_100g': 100 },
          },
        }),
      ),
    )

    const result = await lookupBarcode('6666666666666')
    expect(result.name).toBe('Unknown product')
  })
})
