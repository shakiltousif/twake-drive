import type { Adapter, Lock, Properties, Resource, User } from "nephele";
import { Readable } from "stream";
import { PropertiesService } from "./properties";

import gr from "../../global-resolver";
import { calculateItemSize } from "../../documents/utils";
import { DriveFile } from "../../documents/entities/drive-file";
import { DriveExecutionContext } from "../../documents/types";
import assert from "assert";
import { checkAccess } from "../../documents/services/access-check";
import { FileVersion } from "../../documents/entities/file-version";

export class ResourceService implements Resource {
  /**
   * This is implementation of Resource from nephele package
   *
   * @adapter -  the adapter of the resource
   * @pathname - the pathname as an array of strings to the resource (either directory or file)
   * Each item is actual names of the DriveItems and not ids
   * @context - DriveExecutionContext of the resource
   * @file - DriveItem if exists. Assumed that if it is null, then the file does not exist
   * @pathIds - path to the DriveItem represented as an Array of ids of parent files
   */
  adapter: Adapter;
  pathname: string[];
  baseUrl: URL;
  context: DriveExecutionContext;
  file?: DriveFile | null;
  pathIds?: string[] | null;
  constructor({
    adapter,
    baseUrl,
    pathname,
    context,
    file,
    pathIds,
  }: {
    adapter: Adapter;
    baseUrl: URL;
    pathname: string[];
    context: DriveExecutionContext;
    file?: DriveFile | null;
    pathIds?: string[] | null;
  }) {
    this.adapter = adapter;
    this.baseUrl = baseUrl;
    this.pathname = pathname;
    this.context = context;
    this.file = file;
    this.pathIds = pathIds;
  }

  loadPath = async (pathname: string[]): Promise<string[]> => {
    // const path: string[] = [];
    // TODO[ASH] remove the next two lines and do actual rooting
    pathname.shift();
    const path: string[] = ["user_" + this.context.user.id];
    let item = null;
    let parent_id = path[path.length - 1];
    while (pathname.length > 0) {
      const name = pathname.shift();
      item = await gr.services.documents.documents.findByName(name, parent_id, this.context);
      parent_id = item.id;
      path.push(item.id);
    }
    return path;
  };

  /**
   * Check if the resource exists
   */
  exists = async (): Promise<boolean> => {
    // TODO: if file not specified: search for file
    if (!this.file) {
      // try to load by pathname
      try {
        //slice() to create a copy of the path
        this.pathIds = await this.loadPath(this.pathname.slice());
        this.file = (
          await gr.services.documents.documents.get(
            this.pathIds[this.pathIds.length - 1],
            this.context,
          )
        ).item;
        return true;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  /**
   * Returns execution context for the user based on the execution context of the resource
   *
   * @param user
   */
  getUserContext = (user: User): DriveExecutionContext => {
    const context = this.context;
    context.user.id = user.username;
    context.company.id = user.groupname;
    return context;
  };

  /**
   * Return any locks currently saved for this resource.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  getLocks = (): Promise<Lock[]> => {
    // TODO: create locks
    return Promise.resolve([] as Lock[]);
  };

  /**
   * Return any locks currently saved for this resource for the given user.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  getLocksByUser = (user: User): Promise<Lock[]> => {
    // TODO: create locks for users
    return Promise.resolve([] as Lock[]);
  };

  /**
   * Create a new lock for this user.
   *
   * The defaults for the lock don't matter. They will be assigned by Nephele
   * before being saved to storage.
   */
  createLockForUser = (user: User): Promise<Lock> => {
    // TODO: create lock
    return Promise.resolve(null);
  };

  /**
   * Return a properties object for this resource.
   */
  getProperties = (): Promise<Properties> => {
    return Promise.resolve(new PropertiesService(this));
  };

  /**
   * Get a readable stream of the content of the resource.
   *
   * If a range is included, the stream should return the requested byte range
   * of the content.
   *
   * If the request is aborted prematurely, `detroy()` will be called on the
   * stream. You should listen for this event and clean up any open file handles
   * or streams.
   */
  getStream = async (range?: { start: number; end: number }): Promise<Readable> => {
    // TODO: implement stream ranges
    const downloadObject = await gr.services.documents.documents.download(
      this.file.id,
      null,
      this.context,
    );
    const file = downloadObject.file;
    return Promise.resolve(file.file);
  };

  /**
   * Put the input stream into the resource.
   *
   * If the resource is a collection, and it can't accept a stream (like a
   * folder on a filesystem), a MethodNotSupportedError may be thrown.
   */
  setStream = async (input: Readable, user: User, mediaType?: string): Promise<void> => {
    // TODO: implement setting streams
    return Promise.resolve();
  };

  /**
   * Create the resource.
   *
   * If the resource is a collection, the collection should be created normally.
   *
   * If the resource is not a collection, the resource should be created as an
   * empty resource. This probably means a lock is being created for the
   * resource.
   *
   * If the resource already exists, a ResourceExistsError should be thrown.
   */
  create = async (user: User): Promise<void> => {
    // TODO: check for shared files
    assert(!(await this.exists()), "ResourceNotFoundError");

    const user_context = this.getUserContext(user);
    const path_to_parent = this.pathname.slice(0, this.pathname.length - 1);
    assert(path_to_parent.length > 0, "ResourceExistsError: cannot create root");
    {
      const parent_resource = new ResourceService({
        adapter: this.adapter,
        baseUrl: this.baseUrl,
        pathname: path_to_parent,
        context: user_context,
      });
      assert(await parent_resource.exists(), "ResourceTreeNotCompleteError");
    }
    const new_content = {
      parent_id: path_to_parent[path_to_parent.length - 1],
      name: this.pathname[this.pathname.length - 1],
    };
    this.file = await gr.services.documents.documents.create(null, new_content, null, user_context);
    // TODO: move it to the create function in documents service
    await gr.services.documents.documents.getAccess(this.file.id, user.username, user_context);
  };

  /**
   * Delete the resource.
   *
   * If the resource is a collection, it should only be deleted if it's empty.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to delete the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to delete the resource, a ForbiddenError should be
   * thrown.
   */
  delete = async (user: User): Promise<void> => {
    assert(await this.exists(), "ResourceNotFoundError");

    // TODO: implement deleting for shared files
    return Promise.resolve(
      gr.services.documents.documents.delete(this.file.id, this.file, this.getUserContext(user)),
    );
  };

  /**
   * Copy the resource to the destination.
   *
   * If the resource is a collection, do not copy its contents (internal
   * members), only its properties.
   *
   * This **must not** copy any locks along with the resource.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to copy the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to copy the resource, a ForbiddenError should be
   * thrown.
   *
   * If the destination is outside of this adapter's ability to modify, a
   * BadGatewayError should be thrown.
   *
   * If the destination would be a member of a collection that doesn't exist
   * (like a file in a folder that doesn't exist), a
   * ResourceTreeNotCompleteError should be thrown.
   *
   * If the source and the destination ultimately resolve to the same resource,
   * or the destination falls under the source itself, a ForbiddenError should
   * be thrown.
   */
  //TODO: check copying collection into itself
  copy = async (destination: URL, baseUrl: URL, user: User): Promise<void> => {
    // remove trailing slashes and make an array from it
    const dest_path = destination.pathname.replace(/\/?$/, "").slice(1).split("/");
    assert(dest_path.length > 0, "Destination cannot be null");
    assert(await this.exists(), "ResourceNotFoundError");

    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new Error("Resource tree not completed");
    }

    const new_content = this.file;
    new_content.parent_id = parent_path[parent_path.length - 1];
    new_content.name = dest_path[dest_path.length - 1];
    await gr.services.documents.documents.copy(
      this.file.id,
      this.file,
      new_content,
      this.getUserContext(user),
    );
  };

  /**
   * Move the resource to the destination.
   *
   * This will only be called on non-collection resources. Collection resources
   * will instead by copied, have their contents moved, then be deleted.
   *
   * This **must not** move any locks along with the resource.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to move the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to move the resource, a ForbiddenError should be
   * thrown.
   *
   * If the destination is outside of this adapter's ability to modify, a
   * BadGatewayError should be thrown.
   *
   * If the destination would be a member of a collection that doesn't exist
   * (like a file in a folder that doesn't exist), a
   * ResourceTreeNotCompleteError should be thrown.
   *
   * If the source and the destination ultimately resolve to the same resource,
   * or the destination falls under the source itself, a ForbiddenError should
   * be thrown.
   */
  move = async (destination: URL, baseUrl: URL, user: User): Promise<void> => {
    // remove trailing slashes and make an array from it
    const dest_path = destination.pathname.replace(/\/?$/, "").slice(1).split("/");
    assert(dest_path.length > 0, "Destination cannot be null");
    assert(await this.exists(), "ResourceNotFoundError");

    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new Error("Resource tree not completed");
    }

    const new_content = this.file;
    new_content.parent_id = parent_path[parent_path.length - 1];
    new_content.name = dest_path[dest_path.length - 1];
    await gr.services.documents.documents.move(
      this.file.id,
      this.file,
      new_content,
      this.getUserContext(user),
    );
  };

  /**
   * Return the length, in bytes, of this resource's content (what would be
   * returned from getStream).
   */
  getLength = async (): Promise<number> => {
    console.log("ResourceService::getLength called()");
    if (!(await this.exists()) || (await this.isCollection())) {
      return Promise.resolve(0);
    }

    return Promise.resolve(
      calculateItemSize(this.file, gr.services.documents.documents.repository, this.context),
    );
  };

  /**
   * Return the current ETag for this resource.
   */
  getEtag = async (): Promise<string> => {
    try {
      return Promise.resolve(this.file.last_version_cache.id);
    } catch (err) {
      console.log("No Version Cache for ", this);
      return Promise.resolve("none");
    }
  };

  /**
   * MIME type.
   *
   * You can use `mime` or `mmmagic` if you don't know it.
   *
   * If the resource doesn't have a media type (like a folder in a filesystem),
   * return null.
   */
  getMediaType = async (): Promise<string | null> => {
    console.log("ResourceService::getMediaType called()");
    return Promise.resolve(
      !(await this.exists()) || (await this.isCollection())
        ? null
        : this.file.last_version_cache.file_metadata.mime,
    );
  };

  /**
   * The canonical name of the resource. (The basename of its path.)
   */
  getCanonicalName = async (): Promise<string> => {
    console.log("ResourceService::canonicalName called()");
    assert(await this.exists(), "ResourceNotFoundError");

    return Promise.resolve(this.file.name);
  };

  /**
   * The canonical path relative to the root of the adapter.
   *
   * This should **not** be URL encoded.
   */
  getCanonicalPath = async (): Promise<string> => {
    assert(await this.exists(), "ResourceNotFoundError");

    return this.pathname.join("/");
  };

  /**
   * The canonical URL must be within the adapter's namespace, and must
   * not have query parameters.
   *
   * The adapter's namespace in the current request is provided to the adapter
   * as `baseUrl` when the resource is requested.
   */
  getCanonicalUrl = async (): Promise<URL> => {
    return new URL(
      (await this.getCanonicalPath())
        .split("/")
        .map(encodeURIComponent)
        .join("/")
        .replace(/^\//, () => ""),
      this.baseUrl,
    );
  };

  /**
   * Return whether this resource is a collection.
   */
  isCollection = async (): Promise<boolean> => {
    assert(await this.exists(), "ResourceNotFoundError");

    return Promise.resolve(this.file.is_directory);
  };

  /**
   * Get the internal members of the collection.
   *
   * Internal members are the direct descendents (children) of a collection. If
   * this is called on a resource that is not a collection, it should throw a
   * MethodNotSupportedError.
   *
   * If the user doesn't have permission to see the internal members, an
   * UnauthorizedError should be thrown.
   */
  getInternalMembers = async (user: User): Promise<Resource[]> => {
    console.log("ResourceService::getInternalMembers called()");
    console.log(this.file);
    assert(await this.exists(), "ResourceNotFoundError");
    assert(
      await checkAccess(
        this.file.id,
        this.file,
        "read",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      "UnauthorizedError",
    );
    assert(this.file.is_directory, "MethodNotSupportedError");
    try {
      const item = await gr.services.documents.documents.get(this.file.id, this.context);

      return Promise.resolve(
        item.children.map(
          child =>
            new ResourceService({
              adapter: this.adapter,
              baseUrl: this.baseUrl,
              pathname: this.pathname.concat([child.name]),
              context: this.context,
              file: child,
              pathIds: this.pathIds.concat([this.file.id]),
            }),
        ),
      );
    } catch (err) {
      console.error(err);
      throw new Error("BadGatewayError");
    }
  };
  /**
   * Returns last version about the resource
   */
  getVersions = async (): Promise<FileVersion[]> => {
    assert(await this.exists(), "ResourceNotFoundError");
    return Promise.resolve(
      (await gr.services.documents.documents.get(this.file.id, this.context)).versions,
    );
  };

  /**
   * Returns total space used by user
   */
  getTotalSpace = async (): Promise<number> => {
    return Promise.resolve(await gr.services.documents.documents.userQuota(this.context));
  };

  /**
   * Returns free space for the user
   */
  getFreeSpace = async (): Promise<number> => {
    return Promise.resolve(
      gr.services.documents.documents.defaultQuota - (await this.getTotalSpace()),
    );
  };
}
