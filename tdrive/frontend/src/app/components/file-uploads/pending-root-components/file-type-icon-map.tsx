import {
  FileTypeArchiveIcon,
  FileTypeDocumentIcon,
  FileTypeSpreadsheetIcon,
  FileTypeMediaIcon,
  FileTypeSlidesIcon,
  FileTypePdfIcon,
} from 'app/atoms/icons-colored';

// Map mime types to their respective JSX icon elements
export const fileTypeIconsMap = {
  'application/pdf': <FileTypePdfIcon />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
    <FileTypeDocumentIcon />
  ),
  'application/msword': <FileTypeDocumentIcon />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileTypeSpreadsheetIcon />,
  'application/vnd.ms-excel': <FileTypeSpreadsheetIcon />,
  'application/vnd.ms-powerpoint': <FileTypeSlidesIcon />,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (
    <FileTypeSlidesIcon />
  ),
  'application/zip': <FileTypeArchiveIcon />,
  'application/x-rar-compressed': <FileTypeArchiveIcon />,
  'application/x-tar': <FileTypeArchiveIcon />,
  'application/x-7z-compressed': <FileTypeArchiveIcon />,
  'application/x-bzip': <FileTypeArchiveIcon />,
  'application/x-bzip2': <FileTypeArchiveIcon />,
  'application/x-gzip': <FileTypeArchiveIcon />,
  'video/mp4': <FileTypeMediaIcon />,
  'video/mpeg': <FileTypeMediaIcon />,
  'video/ogg': <FileTypeMediaIcon />,
  'video/webm': <FileTypeMediaIcon />,
  'video/quicktime': <FileTypeMediaIcon />,
};
