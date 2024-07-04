import gr from "../../global-resolver";

import { Consumes, logger } from "../../../core/platform/framework";
// import { FilesService } from "src/services/files";
import { FileServiceImpl } from "src/services/files/services";


@Consumes(["files"])
export class WebDAVServiceImpl {
    version: "1";
    filesService: FileServiceImpl;

    async init(): Promise<this> {
        // TODO: check that only neccessary is included 
        // TODO: properly declare all the functions
        try {
            logger.debug('WebDAVServiceImpl::init() -> is called');
            
            // await Promise.all([(this.filesService = gr.services.files.context.getProvider<FileServiceImpl>("files"))]);
        } catch (err) {
            logger.error("Error while initializing webdav service", err);
        }
        return this;
    }
    // async delete(
    //     request: FastifyRequest<{
    //         Params: { company_id: string; id: string };
    //         // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //         Querystring: any;
    //       }>
    // ): Promise<this> {
    //     try {
    //         await this.filesService.delete
    //     }
    // }
}