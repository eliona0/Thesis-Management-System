import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const display = (value) => value || 'Not provided'
const formatStatus = (value) => value ? value.replaceAll('_', ' ') : 'Status unavailable'
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided'

export default function Students() {
  const [theses, setTheses] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/mentor/theses')
      setTheses(Array.isArray(data.theses) ? data.theses : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your students.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(loadStudents, 0)
    return () => window.clearTimeout(request)
  }, [loadStudents])

  const students = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const groupedStudents = new Map()
    theses.forEach((thesis) => {
      const student = thesis.student || {}
      const key = student.id ?? `thesis-${thesis.id}`
      const grouped = groupedStudents.get(key) || { student, theses: [] }
      grouped.theses.push(thesis)
      groupedStudents.set(key, grouped)
    })
    return [...groupedStudents.values()].filter(({ student, theses: studentTheses }) => {
      const searchable = [fullName(student), student.email, student.studentProfile?.studentNumber, student.studyProgram?.name, ...studentTheses.map((thesis) => thesis.title)]
        .filter(Boolean).join(' ').toLocaleLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
  }, [query, theses])

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>Students</h1><p>Students with a thesis assigned to you, along with their thesis details and progress.</p></header>
    <section className="mentor-request-section" aria-labelledby="mentor-students-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Assigned students</span><h2 id="mentor-students-heading">Your students</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{students.length} {students.length === 1 ? 'student' : 'students'}</span><button className="button button-quiet" type="button" onClick={loadStudents} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {!loading && !error && theses.length > 0 && <label className="mentor-list-search"><span>Find a student</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, student number, or thesis" /></label>}
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading your students…</div>
        : error && theses.length === 0 ? <div className="mentor-request-state mentor-request-error"><p>Your students could not be loaded.</p><button className="button button-quiet" type="button" onClick={loadStudents} disabled={loading}>Try again</button></div>
          : theses.length === 0 ? <div className="mentor-request-state">No students are currently assigned to you.</div>
            : students.length === 0 ? <div className="mentor-request-state">No students match “{query}”.</div>
              : <div className="mentor-thesis-list">{students.map(({ student, theses: studentTheses }) => {
                return <article className="student-panel mentor-thesis-card" key={student.id ?? student.studentProfile?.studentNumber}>
                  <div className="mentor-thesis-card-heading"><div><span className="eyebrow">Student</span><h2>{fullName(student)}</h2></div><span className="mentor-count">{studentTheses.length} {studentTheses.length === 1 ? 'thesis' : 'theses'}</span></div>
                  <dl className="student-detail-list mentor-thesis-details">
                    <div><dt>Email</dt><dd>{display(student.email)}</dd></div>
                    <div><dt>Student number</dt><dd>{display(student.studentProfile?.studentNumber)}</dd></div>
                    <div><dt>Study program</dt><dd>{display(student.studyProgram?.name)}</dd></div>
                  </dl>
                  <div className="mentor-student-theses">{studentTheses.map((thesis) => <section className="mentor-student-thesis" key={thesis.id}>
                    <div className="mentor-thesis-card-heading"><div><span className="eyebrow">Thesis</span><h3>{display(thesis.title)}</h3></div><span className={`request-status status-${String(thesis.status || 'unknown').toLowerCase()}`}>{formatStatus(thesis.status)}</span></div>
                    <dl className="student-detail-list mentor-thesis-details">
                      <div><dt>Research field</dt><dd>{display(thesis.researchField)}</dd></div>
                      <div><dt>Assigned since</dt><dd>{formatDate(thesis.startedAt || thesis.createdAt)}</dd></div>
                    </dl>
                    {thesis.description && <p className="mentor-thesis-description">{thesis.description}</p>}
                    {thesis.status === 'IN_PROGRESS' && <Link className="button button-primary" to={`/mentor/theses/${thesis.id}/versions`}>View thesis versions</Link>}
                  </section>)}</div>
                </article>
              })}</div>}
    </section>
  </div>
}
