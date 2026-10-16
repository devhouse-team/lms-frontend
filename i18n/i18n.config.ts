const ru = new Intl.PluralRules('ru')
const RU_FORM = { one: 0, few: 1, many: 2, other: 2, zero: 2, two: 2 } as const

/** Russian plurals in three forms: "{n} курс | {n} курса | {n} курсов" with t(key, n) */
export default defineI18nConfig(() => ({
  pluralRules: {
    ru: (n: number, forms: number) => (forms < 3 ? (n === 1 ? 0 : 1) : RU_FORM[ru.select(n)])
  }
}))
