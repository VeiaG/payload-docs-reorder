import type { z } from 'zod'

import type { schema } from './saveChanges.js'

export type SaveChangesArgs = z.infer<typeof schema>

export type SaveChangesResult = {
  success: boolean
}
