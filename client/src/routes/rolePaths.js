export const roleHomePath = (role) => ({
  STUDENT: '/student/dashboard',
  MENTOR: '/mentor/dashboard',
  ADMIN: '/admin/dashboard',
  COMMITTEE_MEMBER: '/committee/dashboard',
}[role] || '/login')
