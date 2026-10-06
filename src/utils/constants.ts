import type { Locale } from '../types/ocean'

export const languageColors: Record<string, string> = {
  Dart: '#31b9f3',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Go: '#00add8',
  Rust: '#dea584',
  'C#': '#178600',
  'C++': '#f34b7d',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Ruby: '#701516',
}

export const initialGithubLogin = new URLSearchParams(window.location.search).get('github')

const configuredApiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''
export const apiUrl = (path: `/api/${string}`) => `${configuredApiOrigin}${path}`

export const copy: Record<Locale, Record<string, string>> = {
  'pt-BR': {
    search: 'Encontre um barco pelo GitHub.',
    username: 'Nome de usuário',
    go: 'Ir ao porto',
    login: 'Entrar com GitHub',
    home: 'Ir ao meu porto',
    loading: 'Navegando…',
    hideSearch: 'Ocultar busca',
    showSearch: 'Mostrar busca',
    initial: 'Digite um usuário público do GitHub para encontrar seu porto.',
    controls: 'WASD para navegar · Scroll para zoom · Botão direito para câmera livre',
    world: 'Ilhas evoluem pelos assets, sem crescer lateralmente',
    repos: 'repos',
    followers: 'seguidores',
  },
  en: {
    search: 'Find a boat through GitHub.',
    username: 'Username',
    go: 'Go to harbour',
    login: 'Sign in with GitHub',
    home: 'Go to my harbour',
    loading: 'Sailing…',
    hideSearch: 'Hide search',
    showSearch: 'Show search',
    initial: 'Enter a public GitHub username to find their harbour.',
    controls: 'WASD to sail · Scroll to zoom · Right-drag for free camera',
    world: 'Islands evolve through assets, without expanding sideways',
    repos: 'repos',
    followers: 'followers',
  },
  es: {
    search: 'Encuentra un barco en GitHub.',
    username: 'Nombre de usuario',
    go: 'Ir al puerto',
    login: 'Entrar com GitHub',
    home: 'Ir a mi puerto',
    loading: 'Navegando…',
    hideSearch: 'Ocultar búsqueda',
    showSearch: 'Mostrar búsqueda',
    initial: 'Escribe un usuario público de GitHub para encontrar su puerto.',
    controls: 'WASD para navegar · Rueda para zoom · Botón derecho para cámara libre',
    world: 'Las islas evolucionan con assets, sin crecer lateralmente',
    repos: 'repos',
    followers: 'seguidores',
  },
}
