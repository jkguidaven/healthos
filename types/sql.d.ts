// Drizzle migration .sql files are inlined as strings via babel-plugin-inline-import
declare module '*.sql' {
  const content: string
  export default content
}
