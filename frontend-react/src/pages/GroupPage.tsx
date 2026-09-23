import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, type Balance, type Expense, type GroupDetail, type User } from '../api'
import { formatPaise, rupeesToPaise } from '../money'
import ErrorMessage from '../components/ErrorMessage'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'

export default function GroupPage() {
  const groupId = Number(useParams().id)
  const navigate = useNavigate()
  const [me, setMe] = useState<User | null>(null)
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [error, setError] = useState<string | null>(null)

  const [memberEmail, setMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)

  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleError, setSettleError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadMoney = useCallback(() => {
    api.getBalances(groupId).then(setBalances).catch((e) => setError(e.message))
    api.listExpenses(groupId).then(setExpenses).catch((e) => setError(e.message))
  }, [groupId])

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null))
    api.getGroup(groupId).then(setGroup).catch((e) => setError(e.message))
    loadMoney()
  }, [groupId, loadMoney])

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    setAddingMember(true)
    setMemberError(null)
    try {
      setGroup(await api.addMember(groupId, memberEmail))
      setMemberEmail('')
      loadMoney()
    } catch (err) {
      setMemberError((err as Error).message)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleSettle(e: FormEvent) {
    e.preventDefault()
    const amountPaise = rupeesToPaise(settleAmount)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      setSettleError('Amount must be greater than zero')
      return
    }
    if (fromUser === toUser) {
      setSettleError('Payer and payee must be different')
      return
    }
    setSettleError(null)
    try {
      await api.settle(groupId, {
        from_user: Number(fromUser),
        to_user: Number(toUser),
        amount_paise: amountPaise,
      })
      setSettleAmount('')
      loadMoney()
    } catch (err) {
      setSettleError((err as Error).message)
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm('Delete this group and all its expenses?')) return
    setDeleting(true)
    setError(null)
    try {
      await api.deleteGroup(groupId)
      navigate('/groups', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setDeleting(false)
    }
  }

  if (error && !group) return <ErrorMessage message={error} />
  if (!group) return <p className="muted">Loading...</p>

  return (
    <>
      <h1>{group.name}</h1>
      <ErrorMessage message={error} />

      <section className="card">
        <h3>Members</h3>
        <ul className="list">
          {group.members.map((m) => (
            <li key={m.id}>
              {m.name} <span className="muted">({m.email})</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddMember} className="inline">
          <input
            type="email"
            placeholder="Add member by email"
            required
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
          />
          <button type="submit" disabled={addingMember}>
            Add
          </button>
        </form>
        <ErrorMessage message={memberError} />
      </section>

      <section className="card">
        <h3>Balances</h3>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.user_id}>
                <td>{b.name}</td>
                <td className={`num ${b.net_paise >= 0 ? 'positive' : 'negative'}`}>
                  {formatPaise(b.net_paise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Positive means the member is owed money.</p>
      </section>

      <form onSubmit={handleSettle} className="card">
        <h3>Settle up</h3>
        <div className="row">
          <label>
            From
            <select required value={fromUser} onChange={(e) => setFromUser(e.target.value)}>
              <option value="">Select</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select required value={toUser} onChange={(e) => setToUser(e.target.value)}>
              <option value="">Select</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (INR)
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
            />
          </label>
        </div>
        <ErrorMessage message={settleError} />
        <button type="submit">Record settlement</button>
      </form>

      <ExpenseForm groupId={groupId} members={group.members} onCreated={loadMoney} />

      <section className="card">
        <h3>Expenses</h3>
        <ExpenseList
          expenses={expenses}
          members={group.members}
          currentUserId={me?.id}
          onDeleted={loadMoney}
        />
      </section>

      {me?.id === group.created_by && (
        <section className="card">
          <h3>Danger zone</h3>
          <button type="button" className="danger" disabled={deleting} onClick={handleDeleteGroup}>
            Delete group
          </button>
        </section>
      )}
    </>
  )
}
