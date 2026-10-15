import { z } from 'zod'

type T = (key: string) => string

/**
 * The API's password policy (backend PASSWORD_* settings, crudauth PasswordPolicy), checked before submitting.
 * Letters and digits are Unicode-aware like Python's str methods; "special" is anything else, spaces included.
 * The API may still refuse (e.g. a password containing the username): show its field message.
 */
export const passwordSchema = (t: T) => z.string()
  .min(8, t('password.err.length'))
  .max(128, t('password.err.length'))
  .regex(/\p{Lu}/u, t('password.err.upper'))
  .regex(/\p{Ll}/u, t('password.err.lower'))
  .regex(/\p{Nd}/u, t('password.err.digit'))
  .regex(/[^\p{L}\p{N}]/u, t('password.err.special'))
