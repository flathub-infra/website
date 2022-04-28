import { Html, Head, Main, NextScript } from "next/document"

export default function Document() {
  return (
    <Html>
      <Head>
        <base href="/" />

        <link rel="icon" type="image/png" href="./favicon.png" />
        <link
          href="https://dl.flathub.org/repo/assets/Inter-3.19/inter.css"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
