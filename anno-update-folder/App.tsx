import React from 'react';
import AnnotationModal from './components/AnnotationModal';

const App = () => {
  return (
    <div className="app-container">
      <AnnotationModal 
        isOpen={true} 
        onClose={() => {}} 
      />
    </div>
  );
};

export default App;