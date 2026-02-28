import { useNavigate } from 'react-router-dom';
import ImportModal from '../components/ImportModal';

export default function ImportPage() {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/dashboard');
  };

  return <ImportModal embedded isOpen onClose={handleClose} />;
}
