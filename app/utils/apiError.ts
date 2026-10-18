interface ErrorJson {
  statusMessage?: string
  message?: string
  data?: { details?: { fields?: { loc: (string | number)[], msg: string }[], reason?: string } }
}

/**
 * Reads an error from a Nitro route (null-safe): `code` is the API's error.code, `reason` its `details.reason`, `field()` its
 * validation message for one input
 */
export function apiError(e: unknown) {
  const err = (e ?? {}) as { statusCode?: number, data?: ErrorJson }
  return {
    status: err.statusCode,
    code: err.data?.statusMessage,
    message: err.data?.message,
    reason: err.data?.data?.details?.reason,
    field: (name: string) => err.data?.data?.details?.fields?.filter(f => f.loc[1] === name).map(f => f.msg).join(' ') || undefined
  }
}
