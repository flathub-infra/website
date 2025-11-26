declare module "negotiator" {
  type HeaderValues = Record<string, string | string[] | undefined>

  class Negotiator {
    constructor(request: { headers: HeaderValues })

    language(available?: string[]): string | null
    languages(available?: string[]): string[]
  }

  export = Negotiator
}
