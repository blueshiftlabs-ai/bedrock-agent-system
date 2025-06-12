import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redirect to the overview page in the dashboard
  redirect('/overview')
}