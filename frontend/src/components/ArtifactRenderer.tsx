import React, { useMemo } from 'react';
import { TimelineArtifact } from './TimelineArtifact';
import { Message } from '../types';

interface ArtifactRendererProps {
  artifact: NonNullable<Message['artifact']>;
}

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({ artifact }) => {
  const { type, name, data, content } = artifact;

  if (type === 'component') {
    if (name === 'AcquisitionTimeline') {
      return <TimelineArtifact data={data} />;
    }
    // Add more component-based artifacts here
    return (
      <div className="flex items-center justify-center h-full text-on-surface-variant font-mono text-sm italic">
        Component "{name}" not found.
      </div>
    );
  }

  if (type === 'html' && content) {
    // Generate a blob URL for the HTML content for a cleaner iframe experience
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    return (
      <iframe
        src={url}
        className="w-full h-full border-none bg-white rounded-lg"
        title={name || 'Artifact'}
        sandbox="allow-scripts"
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-on-surface-variant font-mono text-sm italic">
      Unsupported artifact type: {type}
    </div>
  );
};
