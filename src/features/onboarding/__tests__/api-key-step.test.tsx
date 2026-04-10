import React from 'react'
import { Linking } from 'react-native'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/test-utils/render'
import { ApiKeyStep } from '@features/onboarding/api-key-step'
import { router } from 'expo-router'
import * as apiKeyModule from '@ai/api-key'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}))

jest.mock('@ai/api-key', () => ({
  validateApiKey: jest.fn(),
  saveApiKey: jest.fn(),
  clearApiKey: jest.fn(),
}))

const mockedReplace = router.replace as jest.MockedFunction<
  typeof router.replace
>
const mockedValidate = apiKeyModule.validateApiKey as jest.MockedFunction<
  typeof apiKeyModule.validateApiKey
>
const mockedSave = apiKeyModule.saveApiKey as jest.MockedFunction<
  typeof apiKeyModule.saveApiKey
>
const mockedClear = apiKeyModule.clearApiKey as jest.MockedFunction<
  typeof apiKeyModule.clearApiKey
>

describe('ApiKeyStep', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockedReplace.mockClear()
    mockedValidate.mockReset()
    mockedSave.mockReset()
    mockedClear.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders title, subtitle, info, CTA, and skip link', () => {
    const { getByText } = renderWithProviders(<ApiKeyStep />)

    expect(getByText('Connect Gemini')).toBeTruthy()
    expect(
      getByText(/Powers food scanning, workout plans, and your daily coach\./),
    ).toBeTruthy()
    expect(getByText(/Your key is stored securely/)).toBeTruthy()
    expect(getByText('Validate & save')).toBeTruthy()
    expect(getByText('Skip for now')).toBeTruthy()
  })

  it('CTA is disabled while input is empty', () => {
    const { getByText } = renderWithProviders(<ApiKeyStep />)
    const cta = getByText('Validate & save')
    fireEvent.press(cta)
    expect(mockedValidate).not.toHaveBeenCalled()
  })

  it('validates, saves, and navigates to tabs on success', async () => {
    mockedValidate.mockResolvedValueOnce({ valid: true })
    mockedSave.mockResolvedValueOnce(undefined)

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ApiKeyStep />,
    )

    fireEvent.changeText(getByPlaceholderText('AIza…'), 'AIza-test-key')
    fireEvent.press(getByText('Validate & save'))

    await waitFor(() => {
      expect(mockedValidate).toHaveBeenCalledWith('AIza-test-key')
    })
    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith('AIza-test-key')
    })
    await waitFor(() => {
      expect(getByText("Key validated — you're all set")).toBeTruthy()
    })

    jest.runAllTimers()

    await waitFor(() => {
      expect(mockedReplace).toHaveBeenCalledWith('/(tabs)')
    })
  })

  it('shows invalid_key error when validation fails with invalid_key', async () => {
    mockedValidate.mockResolvedValueOnce({ valid: false, error: 'invalid_key' })

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ApiKeyStep />,
    )

    fireEvent.changeText(getByPlaceholderText('AIza…'), 'bad-key')
    fireEvent.press(getByText('Validate & save'))

    await waitFor(() => {
      expect(getByText('Key was rejected by Google AI Studio')).toBeTruthy()
    })
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedReplace).not.toHaveBeenCalled()
  })

  it('shows network_error message on network failure', async () => {
    mockedValidate.mockResolvedValueOnce({
      valid: false,
      error: 'network_error',
    })

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ApiKeyStep />,
    )

    fireEvent.changeText(getByPlaceholderText('AIza…'), 'AIza-test')
    fireEvent.press(getByText('Validate & save'))

    await waitFor(() => {
      expect(getByText('Check your connection and try again')).toBeTruthy()
    })
  })

  it('shows rate_limit message on rate_limit error', async () => {
    mockedValidate.mockResolvedValueOnce({
      valid: false,
      error: 'rate_limit',
    })

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ApiKeyStep />,
    )

    fireEvent.changeText(getByPlaceholderText('AIza…'), 'AIza-test')
    fireEvent.press(getByText('Validate & save'))

    await waitFor(() => {
      expect(getByText('Rate limit hit — try again in a moment')).toBeTruthy()
    })
  })

  it('toggles show/hide key label', () => {
    const { getByText } = renderWithProviders(<ApiKeyStep />)
    expect(getByText('Show key')).toBeTruthy()
    fireEvent.press(getByText('Show key'))
    expect(getByText('Hide key')).toBeTruthy()
  })

  it('opens Google AI Studio when the get-key link is tapped', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true)
    const { getByText } = renderWithProviders(<ApiKeyStep />)

    fireEvent.press(getByText('Get a free key at aistudio.google.com →'))

    expect(spy).toHaveBeenCalledWith('https://aistudio.google.com/apikey')
    spy.mockRestore()
  })

  it('clears the key and navigates to tabs on skip', async () => {
    mockedClear.mockResolvedValueOnce(undefined)

    const { getByText } = renderWithProviders(<ApiKeyStep />)
    fireEvent.press(getByText('Skip for now'))

    await waitFor(() => {
      expect(mockedClear).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockedReplace).toHaveBeenCalledWith('/(tabs)')
    })
  })
})
