import { ReactNode } from "react"
import "../styles/main.css"
import "src/utils/axios-config"

export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
