import { useSocket } from '../hooks/useSocket'
import ConversationList from '../components/ConversationList'
import ConversationWindow from '../components/ConversationWindow'
import CustomerDetails from '../components/CustomerDetails'

export default function Conversations() {
  useSocket()

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList />
      <ConversationWindow />
      <CustomerDetails />
    </div>
  )
}
