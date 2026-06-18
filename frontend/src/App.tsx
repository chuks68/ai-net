import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import NewTaskPage from './pages/tasks/NewTaskPage';

function TaskDetailPlaceholder() {
  const { taskId } = useParams();

  return (
    <main className="page-shell">
      <h1>Task {taskId}</h1>
      <p>Live task monitoring will be implemented in issue #13.</p>
      <Link to="/tasks/new">Submit another task</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tasks/new" replace />} />
      <Route path="/tasks/new" element={<NewTaskPage />} />
      <Route path="/tasks/:taskId" element={<TaskDetailPlaceholder />} />
    </Routes>
  );
}
