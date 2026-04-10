/**
 * src/lib/external/__tests__/wger.test.ts
 *
 * Unit tests for the WGER exercise database client. We use MSW to
 * intercept the fetch call and feed back representative response
 * shapes (found, empty, transport error, bad payload).
 */

import { http, HttpResponse } from 'msw'

import { setupMswServer } from '@/test-utils/msw-server-setup'
import { server } from '@/test-utils/msw-server'
import {
  WgerNetworkError,
  WgerNotFoundError,
  findBestExercise,
  searchExercises,
} from '../wger'

const WGER_SEARCH_URL = /https:\/\/wger\.de\/api\/v2\/exercise\/search\/.*/

describe('searchExercises', () => {
  setupMswServer()

  it('returns normalised exercises with absolute image URLs', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Barbell Bench Press',
              data: {
                id: 192,
                base_id: 192,
                name: 'Barbell Bench Press',
                category: 'Chest',
                image: '/media/exercise-images/192/Bench-press-1.png',
                image_thumbnail:
                  '/media/exercise-images/192/Bench-press-1.thumbnail.jpg',
              },
            },
            {
              value: 'Dumbbell Bench Press',
              data: {
                id: 88,
                base_id: 88,
                name: 'Dumbbell Bench Press',
                category: 'Chest',
                image: '/media/exercise-images/88/Dumbbell-bench-press.png',
                image_thumbnail:
                  '/media/exercise-images/88/Dumbbell-bench-press.thumbnail.jpg',
              },
            },
          ],
        }),
      ),
    )

    const results = await searchExercises('bench press')

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      id: 192,
      name: 'Barbell Bench Press',
      category: 'Chest',
      imageUrl:
        'https://wger.de/media/exercise-images/192/Bench-press-1.png',
      thumbnailUrl:
        'https://wger.de/media/exercise-images/192/Bench-press-1.thumbnail.jpg',
    })
    expect(results[1]?.id).toBe(88)
  })

  it('respects the limit parameter', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'A',
              data: { id: 1, name: 'A', image: null, image_thumbnail: null },
            },
            {
              value: 'B',
              data: { id: 2, name: 'B', image: null, image_thumbnail: null },
            },
            {
              value: 'C',
              data: { id: 3, name: 'C', image: null, image_thumbnail: null },
            },
          ],
        }),
      ),
    )

    const results = await searchExercises('anything', 2)

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.id)).toEqual([1, 2])
  })

  it('handles null images by returning null URLs', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Plank',
              data: {
                id: 77,
                name: 'Plank',
                category: 'Abs',
                image: null,
                image_thumbnail: null,
              },
            },
          ],
        }),
      ),
    )

    const results = await searchExercises('plank')

    expect(results[0]?.imageUrl).toBeNull()
    expect(results[0]?.thumbnailUrl).toBeNull()
    expect(results[0]?.category).toBe('Abs')
  })

  it('defaults category to null when omitted', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Mystery move',
              data: {
                id: 500,
                name: 'Mystery move',
              },
            },
          ],
        }),
      ),
    )

    const results = await searchExercises('mystery')
    expect(results[0]?.category).toBeNull()
    expect(results[0]?.imageUrl).toBeNull()
    expect(results[0]?.thumbnailUrl).toBeNull()
  })

  it('passes through absolute image URLs unchanged', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Squat',
              data: {
                id: 10,
                name: 'Squat',
                image: 'https://cdn.example.com/squat.png',
                image_thumbnail: 'https://cdn.example.com/squat-thumb.jpg',
              },
            },
          ],
        }),
      ),
    )

    const results = await searchExercises('squat')
    expect(results[0]?.imageUrl).toBe('https://cdn.example.com/squat.png')
    expect(results[0]?.thumbnailUrl).toBe(
      'https://cdn.example.com/squat-thumb.jpg',
    )
  })

  it('throws WgerNotFoundError on empty suggestions', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({ suggestions: [] }),
      ),
    )

    await expect(searchExercises('nonsense-word-qz')).rejects.toBeInstanceOf(
      WgerNotFoundError,
    )
  })

  it('exposes the term on WgerNotFoundError', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({ suggestions: [] }),
      ),
    )

    try {
      await searchExercises('ghost lift')
      fail('expected searchExercises to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(WgerNotFoundError)
      if (error instanceof WgerNotFoundError) {
        expect(error.term).toBe('ghost lift')
        expect(error.code).toBe('wger_not_found')
      }
    }
  })

  it('throws WgerNetworkError on non-2xx HTTP responses', async () => {
    server.use(
      http.get(
        WGER_SEARCH_URL,
        () => new HttpResponse(null, { status: 500 }),
      ),
    )

    await expect(searchExercises('bench press')).rejects.toBeInstanceOf(
      WgerNetworkError,
    )
  })

  it('throws WgerNetworkError when fetch itself rejects', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () => HttpResponse.error()),
    )

    await expect(searchExercises('bench press')).rejects.toBeInstanceOf(
      WgerNetworkError,
    )
  })

  it('throws WgerNetworkError when the response shape is unexpected', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Broken',
              data: {
                // Missing required `id` field
                name: 'Broken',
              },
            },
          ],
        }),
      ),
    )

    await expect(searchExercises('broken')).rejects.toBeInstanceOf(
      WgerNetworkError,
    )
  })

  it('throws WgerNetworkError when the JSON body is unreadable', async () => {
    server.use(
      http.get(
        WGER_SEARCH_URL,
        () =>
          new HttpResponse('not json at all', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    await expect(searchExercises('anything')).rejects.toBeInstanceOf(
      WgerNetworkError,
    )
  })
})

describe('findBestExercise', () => {
  setupMswServer()

  it('returns the first matching exercise', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({
          suggestions: [
            {
              value: 'Deadlift',
              data: {
                id: 105,
                name: 'Deadlift',
                category: 'Back',
                image: '/media/exercise-images/105/deadlift.png',
                image_thumbnail:
                  '/media/exercise-images/105/deadlift.thumbnail.jpg',
              },
            },
            {
              value: 'Romanian Deadlift',
              data: {
                id: 106,
                name: 'Romanian Deadlift',
                category: 'Back',
                image: null,
                image_thumbnail: null,
              },
            },
          ],
        }),
      ),
    )

    const result = await findBestExercise('deadlift')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(105)
    expect(result?.imageUrl).toBe(
      'https://wger.de/media/exercise-images/105/deadlift.png',
    )
  })

  it('returns null when no suggestions match', async () => {
    server.use(
      http.get(WGER_SEARCH_URL, () =>
        HttpResponse.json({ suggestions: [] }),
      ),
    )

    const result = await findBestExercise('nonsense-word-qz')
    expect(result).toBeNull()
  })

  it('re-throws WgerNetworkError so callers can react to connectivity issues', async () => {
    server.use(
      http.get(
        WGER_SEARCH_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )

    await expect(findBestExercise('bench press')).rejects.toBeInstanceOf(
      WgerNetworkError,
    )
  })
})
