import RouterServices from '@features/router/services/router-service';
import Resumable from '@features/files/utils/resumable';

/* eslint-disable @typescript-eslint/no-explicit-any */
type TreeItem = { [key: string]: { root: string; file: File } | TreeItem };

export type FileTreeObject = {
  tree: TreeItem;
  documentsCount: number;
  totalSize: number;
};

export const useUploadExp = () => {
  const { companyId } = RouterServices.getStateFromRoute();

  // Initialize a single Resumable instance
  const resumable = new Resumable({
    target: `/upload/${companyId}`, // Example API endpoint, adjust as needed
    chunkSize: 1 * 1024 * 1024, // 1 MB chunk size
    simultaneousUploads: 3,
    testChunks: false,
  });

  // Add files from the tree to the Resumable instance
  const addFilesToResumable = (tree: TreeItem) => {
    const traverseTree = (item: TreeItem) => {
      Object.values(item).forEach(value => {
        if ('file' in value && value.file instanceof File) {
          resumable.addFile(value.file); // Add file to Resumable
        } else {
          traverseTree(value as TreeItem); // Recursively traverse nested items
        }
      });
    };

    traverseTree(tree);
  };

  // Start upload and log each file being uploaded
  const startUpload = () => {
    resumable.on('fileAdded', (file: any) => {
      console.log(`Uploading file: ${file.fileName}`);
    });

    resumable.on('fileSuccess', (file: any, message: any) => {
      console.log(`File uploaded successfully: ${file.fileName}`, message);
    });

    resumable.on('fileError', (file: any, error: any) => {
      console.error(`Error uploading file: ${file.fileName}`, error);
    });

    resumable.upload(); // Start the upload
  };

  // Main uploadTree function
  const uploadTree = (tree: FileTreeObject) => {
    addFilesToResumable(tree.tree); // Add files from the tree
    startUpload(); // Start uploading
  };

  return {
    uploadTree,
  };
};
