/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ComponentStory } from '@storybook/react';
// import { PendingUploadJobsPopup } from './pending-upload-jobs-popup';


// Job



import CloseIcon from '@material-ui/icons/CloseOutlined';

export const PendingUploadJobsPopupHeader = (props: {
  isListingFiles?: boolean,
  failuresListing?: string[],
}) => {
  return <div className='
    w-full
    flex
    flex-col
    items-center
    '>
      <div className='whitespace-nowrap font-extrabold text-xl'>Uploads</div>
      <div className='whitespace-nowrap'>Currently scanning or something</div>
  </div>
};

export const PendingUploadJobRow = () => {
  return <div className='
    w-full
    flex
    flex-row
    items-center
    '>
      <div className='whitespace-nowrap flex-shrink' style={{border: '1px solid green'}}>
        I'm the header !
        <br />
        Line 2
      </div>
      <div style={{border: '1px solid blue'}}>
        <CloseIcon className="h-2 w-2" />
      </div>
      <div style={{border: '1px solid yellow'}}>
        {/* <CloseIcon className="m-icon" /> */}
        <CloseIcon />yo
      </div>
  </div>
};

export const PendingUploadJobsPopup = () => {
  return <>
    <div className='
      bg-slate-200 text-black dark:bg-slate-800 dark:text-white
      border-blue-500 border-2 border-b-0 border-solid
      max-w-lg absolute z-50 right-10 bottom-0 w-32
      rounded-t-lg
      flex
      flex-col
    '>
      <PendingUploadJobsPopupHeader />
      <div className='
        overflow-y-scroll
        max-h-14
        flex-col
        '>
        <PendingUploadJobRow />
        <PendingUploadJobRow />
        <PendingUploadJobRow />
        <PendingUploadJobRow />
        <PendingUploadJobRow />
      </div>
    </div>
  </>;
};





export default {
  //title: '@atoms/pending-upload-jobs-popup', //TODO NONONO
  component: PendingUploadJobsPopup,
};


const Template: ComponentStory<typeof PendingUploadJobsPopup> = PendingUploadJobsPopup;

export const Base = Template.bind({});
// Base.play = () => {
//   // setTimeout(() => window.alert("hi"), 1000)
// }
Base.args = {
};
