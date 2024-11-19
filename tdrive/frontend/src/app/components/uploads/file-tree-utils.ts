/* eslint-disable @typescript-eslint/no-explicit-any */
import { sortNaturally } from "src/utils/array";

/** @deprecated */
type TreeItem = { [key: string]: File | TreeItem };

/** @deprecated use {@see UploadJobRoot} from now on */
export type FileTreeObject = {
  tree: TreeItem;
  documentsCount: number;
  totalSize: number;
};

type UploadItemCommon = { error?: DOMException; };
type UploadFileItemSpecific = { isFile: true;  entry: FileSystemFileEntry; getFile: () => Promise<File> };
type UploadEmptyDirectoryItemSpecific = { isFile: false; entry: FileSystemDirectoryEntry; };

/** Represents a single item to process, either a file to upload, or an empty folder to create, at `.entry.fullPath` */
export type UploadItem = UploadItemCommon & (UploadFileItemSpecific | UploadEmptyDirectoryItemSpecific);

/**
 * When dropping multiple items at once, each is a `UploadJobRoot`, this also contains a flat list of all descendant items.
 * A Job/Root in this sense is an entry, the progression of which is visible to the user. It corresponds to each separate
 * thing the user selected to drop. `titleItem` is just for display, the same item is included in `items` if it requires
 * an upload.
 */
type UploadJobRoot = {
  titleItem: UploadItem;
  items: UploadItem[];
};

/**
 * Result of enumerating a single drop event.
 * It may have multiple roots, if the user picked more than one thing
 * to drop, and failed items to read */
export type UploadDroppedJobs = {
  roots: UploadJobRoot[];
  failed?: UploadItem[];
};

export const getFilesTree = (
  event: Event & { dataTransfer: DataTransfer },
  fcb?: (file: File) => void,
): Promise<FileTreeObject> => {
  return new Promise<FileTreeObject>(function (resolve) {
    function newDirectoryApi(input: DataTransfer, cb: (files?: File[], paths?: string[]) => void) {
      const fd: any[] = [],
        files: any[] = [];
      const iterate = function (entries: any[], path: string, resolve: (v: any[]) => void) {
        const promises: any[] = [];
        entries.forEach(function (entry: any) {
          promises.push(
            new Promise(function (resolve) {
              if ('getFilesAndDirectories' in entry) {
                entry.getFilesAndDirectories().then(function (entries: any[]) {
                  iterate(entries, entry.path + '/', resolve);
                });
              } else {
                if (entry.name) {
                  const p = (path + entry.name).replace(/^[/\\]/, '');
                  fd.push(entry);
                  files.push(p);

                  if (files.length > 1000000) {
                    return false;
                  }
                }
                resolve(true);
              }
            }),
          );
        });

        if (files.length > 1000000) {
          return false;
        }

        Promise.all(promises).then(resolve);
      };
      (input as any).getFilesAndDirectories().then(function (entries: any) {
        new Promise(function (resolve) {
          iterate(entries, '/', resolve);
        }).then(cb.bind(null, fd, files));
      });
    }

    // old prefixed API implemented in Chrome 11+ as well as array fallback
    function arrayApi(input: DataTransfer, cb: (files?: File[], paths?: string[]) => void) {
      const fd: any[] = [],
        files: any[] = [];
      [].slice.call(input.files).forEach(function (file: File) {
        fd.push(file);
        files.push(file.webkitRelativePath || file.name);

        if (files.length > 1000000) {
          return false;
        }
      });

      if (files.length > 1000000) {
        return false;
      }

      cb(fd, files);
    }

    // old drag and drop API implemented in Chrome 11+
    function entriesApi(
      items: DataTransferItemList,
      cb: (files?: File[], paths?: string[]) => void,
    ) {
      const fd: any[] = [],
        files: any[] = [],
        rootPromises: any[] = [];

      const mapFileEntryToUploadItem = (entry: FileSystemFileEntry): UploadItem => ({
          isFile: true,
          entry,
          getFile: () => new Promise((resolve, reject) => entry.file(resolve, reject)),
        });

      const mapDirectoryEntryToUploadItem = (entry: FileSystemDirectoryEntry, error?: DOMException): UploadItem =>
        ({ isFile: false, entry, error });

      const mapEntryToUploadItem = (entry: FileSystemEntry): UploadItem => entry.isFile
          ? mapFileEntryToUploadItem(entry as FileSystemFileEntry)
          : mapDirectoryEntryToUploadItem(entry as FileSystemDirectoryEntry);

      const mapDirectoryEntryToUploadItemsDeep = (entry: FileSystemDirectoryEntry): Promise<UploadItem[]> =>
        new Promise((resolve, _reject_but_should_always_resolve_with_failed_instead) => {
          const reader = entry.createReader();
          reader.readEntries(
            (entries) => resolve(entries.length
              ? Promise.all(entries.flatMap(e => mapEntryToUploadItemsDeep(e)) as unknown as UploadItem[])
              : [mapDirectoryEntryToUploadItem(entry)])
            ,
            (err) => resolve([mapDirectoryEntryToUploadItem(entry, err)])
          )
        });

      const mapEntryToUploadItemsDeep = async (entry: FileSystemEntry): Promise<UploadItem[]> => (entry.isFile
          ? [ await mapFileEntryToUploadItem(entry as FileSystemFileEntry) ]
          : await mapDirectoryEntryToUploadItemsDeep(entry as FileSystemDirectoryEntry)).flat();

      const mapRootEntryToUploadJob = async (dtitem: DataTransferItem): Promise<UploadJobRoot> => {
        const entry = dtitem.webkitGetAsEntry()!;
        return {
          titleItem: mapEntryToUploadItem(entry),
          items: await mapEntryToUploadItemsDeep(entry),
        };
      }

      /**
       * From a single drop event, descend items, then sum up in flat lists:
       * - roots for ui display (corresponds to an item picked by the user when starting the drag)
       *     - each has a title entry, and a list of items to upload and empty folders to create
       *     - if a root is included it has at least one non failed operation
       * - failures of descending those roots
       *
       * Based on:
       *   - https://caniuse.com/?search=webkitGetAsEntry
       *   - https://github.com/leonadler/drag-and-drop-across-browsers (2017)
       *
       * @param items the DataTransferItemList from the browser drop event
       * @returns A list of roots in the format of {@link UploadDroppedJobs}
       */
      async function jobsFromDrop(items: DataTransferItemList): Promise<UploadDroppedJobs> {
        const allRoots = (await Promise.all([...items].map(i => mapRootEntryToUploadJob(i))));
        const failed = allRoots.flatMap(r => r.items.filter(e => !!e.error));
        const roots = allRoots.filter(r => r.items.some(e => !e.error));
        sortNaturally(roots, r => r.titleItem.entry.fullPath);
        return { roots, failed: failed.length ? failed : undefined, };
      }

      const uploadItemToString = (item: UploadItem, prefix = "") => //TODO NONONO
        `${prefix}${item.isFile ? "📄" : "📁"} ${item.entry.fullPath}${item.error ? " (Error: " + (item.error.stack || item.error) + ")" : ""}`;

      jobsFromDrop(items).then(uploadJobs => {
        if (uploadJobs.failed) {
          console.warn(`Failed (${uploadJobs.failed.length}) :`);
          uploadJobs.failed.forEach(i => console.log(uploadItemToString(i, "  ")));
        }
        for (const root of uploadJobs.roots) {
          console.info("🎯", uploadItemToString(root.titleItem));
          root.items.forEach(i => console.log(uploadItemToString(i, "    ")));
        }
        if (uploadJobs.roots.length && fcb) {
          const first = uploadJobs.roots.map(r => r.titleItem).filter(i => i.isFile)[0] as UploadFileItemSpecific;
          first.getFile().then(f => fcb(f));
        }
    }, e => console.error(e));

      function readEntries(entry: any, reader: any, oldEntries: any, cb: any) {
        const dirReader = reader || entry.createReader();
        dirReader.readEntries(function (entries: any) {
          const newEntries = oldEntries ? oldEntries.concat(entries) : entries;
          if (entries.length) {
            setTimeout(readEntries.bind(null, entry, dirReader, newEntries, cb), 0);
          } else {
            cb(newEntries);
          }
        });
      }

      function readDirectory(entry: any, path: null | string, resolve: (v: any) => void) {
        if (!path) path = entry.name;
        readEntries(entry, 0, 0, function (entries: any[]) {
          const promises: Promise<any>[] = [];
          entries.forEach(function (entry: any) {
            promises.push(
              new Promise(function (resolve) {
                if (entry.isFile) {
                  entry.file(function (file: File) {
                    const p = path + '/' + file.name;
                    fd.push(file);
                    files.push(p);
                    if (files.length > 1000000) {
                      return false;
                    }
                    resolve(true);
                  }, resolve.bind(null, true));
                } else readDirectory(entry, path + '/' + entry.name, resolve);
              }),
            );
          });
          Promise.all(promises).then(resolve.bind(null, true));
        });
      }

      [].slice.call(items).forEach(function (entry: any) {
        entry = entry.webkitGetAsEntry();
        if (entry) {
          rootPromises.push(
            new Promise(function (resolve) {
              if (entry.isFile) {
                entry.file(function (file: File) {
                  fd.push(file);
                  files.push(file.name);
                  if (files.length > 1000000) {
                    return false;
                  }
                  resolve(true);
                }, resolve.bind(null, true));
              } else if (entry.isDirectory) {
                readDirectory(entry, null, resolve);
              }
            }),
          );
        }
      });

      if (files.length > 1000000) {
        return false;
      }

      Promise.all(rootPromises).then(cb.bind(null, fd, files));
    }

    const cb = function (event: Event, files: File[], paths?: string[]) {
      const documents_number = paths ? paths.length : 0;
      let total_size = 0;
      const tree: any = {};
      (paths || []).forEach(function (path, file_index) {
        let dirs = tree;
        const real_file = files[file_index];

        total_size += real_file.size;

        path.split('/').forEach(function (dir, dir_index) {
          if (dir.indexOf('.') === 0) {
            return;
          }
          if (dir_index === path.split('/').length - 1) {
            dirs[dir] = real_file;
          } else {
            if (!dirs[dir]) {
              dirs[dir] = {};
            }
            dirs = dirs[dir];
          }
        });
      });

      resolve({ tree, documentsCount: documents_number, totalSize: total_size });
    };

    if (event.dataTransfer) {
      const dt = event.dataTransfer;
      if (dt.items && dt.items.length && 'webkitGetAsEntry' in dt.items[0]) {
        entriesApi(dt.items, (files, paths) => cb(event, files || [], paths));
      } else if ('getFilesAndDirectories' in dt) {
        newDirectoryApi(dt, (files, paths) => cb(event, files || [], paths));
      } else if (dt.files) {
        arrayApi(dt, (files, paths) => cb(event, files || [], paths));
      } else cb(event, [], []);
    } else if (event.target) {
      const t = event.target as any;
      if (t.files && t.files.length) {
        arrayApi(t, (files, paths) => cb(event, files || [], paths));
      } else if ('getFilesAndDirectories' in t) {
        newDirectoryApi(t, (files, paths) => cb(event, files || [], paths));
      } else {
        cb(event, [], []);
      }
    } else {
      fcb && fcb((event.target as any).files[0]);
      resolve({
        tree: (event.target as any).files[0],
        documentsCount: 1,
        totalSize: (event.target as any).files[0].size,
      });
    }
  });
};
