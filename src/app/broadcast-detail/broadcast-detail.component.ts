import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, Input, HostBinding } from '@angular/core';
import { ChatService } from '../chat.service';
import { Router, ActivatedRoute } from '@angular/router';
import * as io from 'socket.io-client';
import * as $ from 'jquery';
import { Buffer } from 'buffer';
//import { Configs } from '../configurations';
import { Configs } from '../../environments/environment';
import { AuthService} from '../auth/auth.service';

@Component({
  selector: 'app-broadcast-detail',
  templateUrl: './broadcast-detail.component.html',
  styleUrls: ['./broadcast-detail.component.css']
})
export class BroadcastDetailComponent implements OnInit {

  @HostBinding('class.view-broadcast') 
  viewBroadcast: any;
  broadcast: any =[];
  editDetail: boolean = false;
  viewDetail: boolean = true;
  addBroadcastPage: boolean = false;
  editBroadcastPage: boolean = false;
  notSelected: boolean = true;
  url = '';  
  showImage: boolean = false;
  enableBroadcast: any = [];
  disableBroadcast: any = [];
  jobDetail: any = [];
  selectedImage: File;
  compressedImage: File;
  csvFile: File;   
  filename: string;
  urlMessage: string;
  tinkerKey: string;
  popUpEmoji: boolean = false;
  fileExtention: string;


  broadcastDetail = { jobID:'', message: '', contactListCsvName:'', imagefile:'', imagefilename:'', notSendAck:'', prependContactName:'', jobStatus:'', groupName:'', senderPhoneNumber:''};  
  
  newBroadcast = { jobID:'', message:'', contactListCsvName: '', imagefile:'', imagefilename:'', notSendAck:'',prependContactName:'', jobStatus:'', groupName:'', senderPhoneNumber:''};  

  updateTinkerStatus = { enableBroadcast:''};

  constructor(private chatService: ChatService, private authService: AuthService, private route: ActivatedRoute, private configs: Configs) {}

  ngOnInit() {

  	this.newBroadcast.prependContactName = "Y";	//Yes

    this.chatService.change.subscribe(viewBroadcast => {
      console.log("this.viewBroadcast.jobID: "+viewBroadcast.jobID);
      this.broadcastDetail = viewBroadcast;

      this.showBroadcastDetail(this.broadcastDetail.jobID);

    });

  }

  showBroadcastDetail(jobID){

		this.chatService.getBroadcastbyJobId(jobID).then((res) => {  //from chatService, 
	      this.broadcast = res;

        if (this.broadcast[0] !=undefined){
          if (this.broadcast[0].imagefile !=undefined){
            console.log(this.broadcast[0].imagefile);          
            this.showImage = true;          
          } else {
            this.showImage = false;          
          }           
        }

	    }, (err) => {
	      console.log(err);
	    });
  }
   
  saveBroadcastDetail(){

  	console.log("create new broadcast job");  	
		// console.log("prepend name: " + this.newBroadcast.prependContactName);

  	this.newBroadcast.jobStatus = "Pending";

    // get admin sessionID
    var sID=localStorage.getItem('res.data.sessionID');
      
    //construct form data
    var enable = new FormData();
    enable.append('sessionID', sID);
    // formDataImage.append('imagefilename', this.selectedImage.name);
    // formDataImage.append('imagefile', this.compressedImage);
	     
	  if (window.confirm('Once broadcast job is submitted, opeartor and administrator chat services will not be available until the job is completed!')){
			
			this.chatService.enableBroadcast(enable).then((res) => {

				this.enableBroadcast = res;
				console.log("Enable broadcast: " +this.enableBroadcast.success);
				
          if (this.enableBroadcast.success == true){

            this.tinkerKey = "running";
            this.updateTinkerStatus.enableBroadcast = "true";

            this.authService.updateTinker(this.tinkerKey, this.updateTinkerStatus).then((res) => {
              
              console.log("update tinker status");
            
            }, (err) => {
              console.log(err);        
            });  

          }
				
				// check if image is attached and post to tinker 				  
				if (this.url.length != 0){	//broadcast image

					console.log("newBroadcast.imagefile: " + this.compressedImage);
  				console.log("newBroadcast.imagefilename: " + this.selectedImage.name);
					
			    //construct form data
			    var boardcastImage = new FormData();
			    boardcastImage.append('sessionID', sID);
			    // boardcastImage.append('message', this.newBroadcast.message);
			    boardcastImage.append('prependContactName', this.newBroadcast.prependContactName); 					
			    boardcastImage.append('contactListCsv', this.csvFile);			    
			    boardcastImage.append('imagefilename', this.selectedImage.name);
			    boardcastImage.append('imagefile', this.compressedImage);  				

          this.urlMessage = this.newBroadcast.message;

					//write to DB
					this.chatService.broadcastImage(boardcastImage, this.urlMessage).then((res) => {  //from chatService, 
				  
				    window.alert('Broadcast job with image is submitted successfully!');

				    this.jobDetail = res;

						if (this.jobDetail.jobID !=undefined){

							this.newBroadcast.jobID = this.jobDetail.jobID;
					  	this.newBroadcast.contactListCsvName = this.csvFile.name;	
					  	this.newBroadcast.imagefile = this.url;
					  	this.newBroadcast.imagefilename = this.selectedImage.name;		
				

							//write to DB
							this.chatService.saveBroadcast(this.newBroadcast).then((res) => {  //from chatService, 
						  
						    // window.alert('Broadcast job is uploaded to DB successfully!');
						  }, (err) => {
						    console.log(err);
						    window.alert('Write Broadcast to DB failed!');
						  });	  
						} else {
							console.log("not able to get job ID");
						}

				  	this.viewBroadcastDetail();  

				  }, (err) => {
				    console.log(err);
				    window.alert('Add Broadcast job failed!');
				  });	  				  

				} else {	//image not exists

					console.log("No imagefile");

			    //construct form data
			    var boardcastMessage = new FormData();
			    boardcastMessage.append('sessionID', sID);
			    // boardcastMessage.append('message', this.newBroadcast.message);
			    boardcastMessage.append('prependContactName', this.newBroadcast.prependContactName); 					
			    boardcastMessage.append('contactListCsv', this.csvFile);

          this.urlMessage = this.newBroadcast.message;

					//write to DB
					this.chatService.broadcastMessage(boardcastMessage, this.urlMessage).then((res) => {  //from chatService, 
				  
				    window.alert('Broadcast job with message only is submitted successfully!');

				    this.jobDetail = res;

						if (this.jobDetail.jobID !=undefined){

							this.newBroadcast.jobID = this.jobDetail.jobID;
					  	this.newBroadcast.contactListCsvName = this.csvFile.name;		

							//write to DB
							this.chatService.saveBroadcast(this.newBroadcast).then((res) => {  //from chatService, 
						  
						    // window.alert('Broadcast job is uploaded to DB successfully!');
						  }, (err) => {
						    console.log(err);
						    window.alert('Write Broadcast to DB failed!');
						  });	  
						} else {
							console.log("not able to get job ID");
						}

				    this.viewBroadcastDetail();

				  }, (err) => {
				    console.log(err);
				    window.alert('Add Broadcast job failed!');
				  });	

				}

		  }, (err) => {
		    console.log(err);
		    window.alert('Add Broadcast job failed!');
		  });	  	

	  } else {
	  	console.log('Broadcast job is cancelled')
	  }




  }

  updateBroadcastDetail(){
  	// this.editUser = this.user;
  	// console.log(this.userDetail.phone_number);
  	// console.log(this.userDetail.nickname);

		this.chatService.updateBroadcast(this.broadcastDetail.jobID, this.broadcastDetail).then((res) => {  //from chatService, 
	      
	    window.alert('Broadcast detail is updated successfully!\nPress "View" button in User List to view updated data!');
	  }, (err) => {
	    console.log(err);
	    window.alert('Update user detail failed!');
	  });
		this.viewBroadcastDetail();
  }

  viewBroadcastDetail(){

		this.editDetail = false;
		this.viewDetail = true;
		this.editBroadcastPage = false; 
		this.addBroadcastPage = false;   	

  	console.log('view Broadcast detail!');
  }

  editBroadcastDetail(){

		this.editDetail = true;
		this.viewDetail = false;
		this.editBroadcastPage = true; 
		this.addBroadcastPage = false; 	

  	console.log('edit Broadcast detail!');
  }

  createBroadcast(){

  	this.editDetail = true;
		this.viewDetail = false;
		this.editBroadcastPage = false; 
		this.addBroadcastPage = true; 
		this.filename = '';
  	console.log(' add Broadcast!');

  }

  exit() {
    console.log("Exit the Broadcast Detail");
    this.editDetail = false;
  }    

  onImageFileSelected(event) {    

    // this.compressedFile = event.target.files[0];

    // this.selectedFile = this.compressFile();
    this.selectedImage = event.target.files[0];


    console.log("event.target.files[0]: " +this.selectedImage);
    console.log("onFileSelected name: " +this.selectedImage.name);
    // console.log("event.target.files: " +event.target.files);  //file list

    if (event.target.files && event.target.files[0]) {

      var reader = new FileReader();
      reader.readAsDataURL(this.selectedImage); // read file as data url
      // reader.readAsArrayBuffer(event.target.files[0]);  //read as Array buffer
      reader.onload = (event:any) => { // called once readAsDataURL is completed        
        // this.url = event.target.result;
        // console.log("url: " +this.url);    //base64

        var img = new Image();
        var imageSize:any;
        var roundedImageSize:any;

        img.src = event.target.result;        

        //jpeg -> base64, size increase 33%. scale factor = 0.75 to get the actual file size
        imageSize = (encodeURI(img.src).split(/%..|./).length - 1)*0.75/1024;
        roundedImageSize = Math.round(imageSize);  

        this.fileExtention = (this.selectedImage.name).split(".")[1];
        console.log('image size : ' + roundedImageSize +'kB');        
        console.log('file extension: ' +this.fileExtention); 
        // console.log('image: ' + img.src );

        img.onload = () => {
           
            var canvas: HTMLCanvasElement = document.createElement("canvas");
            var ctx: CanvasRenderingContext2D = canvas.getContext("2d");

            console.log('img.width: ' +img.width);
            console.log('img.height: ' +img.height);           

            canvas.width = img.width;
            canvas.height = img.height;
            
            // img.width and img.height will give the original dimensions
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            console.log('drawing image: ' + canvas.width +',' + canvas.height);

            if (this.fileExtention == 'gif') {
              if (roundedImageSize <1100){

                // this.url=ctx.canvas.toDataURL('image/gif', 1.0) ;
                this.url = event.target.result;
                // console.log(this.url);     
                this.compressedImage = this.selectedImage;

              } else {

                window.alert('Not supported! Gif file size cannot exceed 1MB!');
                this.url = '';
                this.compressedImage = null;

              }

            } else {

              if (roundedImageSize < 100) {

                this.url=ctx.canvas.toDataURL('image/jpeg', 1.0) ;

                console.log (this.url);

                ctx.canvas.toBlob((blob) => {

                  this.compressedImage = new File([blob], this.selectedImage.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                }, 'image/jpeg', 1.0);
              }  

              if ((roundedImageSize >= 100) && (roundedImageSize <500))  {

                this.url=ctx.canvas.toDataURL('image/jpeg', 0.7) ;

                console.log (this.url);

                ctx.canvas.toBlob((blob) => {

                  this.compressedImage = new File([blob], this.selectedImage.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                }, 'image/jpeg', 0.7);
              }            

              if ((roundedImageSize >= 500) && (roundedImageSize <5000)){

                this.url=ctx.canvas.toDataURL('image/jpeg', 0.5) ;

                console.log (this.url);

                ctx.canvas.toBlob((blob) => {

                  this.compressedImage = new File([blob], this.selectedImage.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                }, 'image/jpeg', 0.5);
              }

              if ((roundedImageSize >= 5000) && (roundedImageSize <16000)){

                window.alert('Image will be compressed significantly as the file is large!');

                this.url=ctx.canvas.toDataURL('image/jpeg', 0.2) ;

                console.log (this.url);

                ctx.canvas.toBlob((blob) => {

                  this.compressedImage = new File([blob], this.selectedImage.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                }, 'image/jpeg', 0.2);
              }            

              if (roundedImageSize >= 16000) {
                
                window.alert('Not supported! Image size is too large!');
                this.url = '';
                this.compressedImage = null;

              }
            }

          },
            reader.onerror = error => console.log(error)
        }
    
    }

  } 

  onCSVSelected(event) {    

    // this.compressedFile = event.target.files[0];

    // this.selectedFile = this.compressFile();
    this.csvFile = event.target.files[0];


    console.log("event.target.files[0]: " +this.csvFile);
    console.log("csvFile name: " +this.csvFile.name);
    // console.log("event.target.files: " +event.target.files);  //file list

    if (event.target.files && event.target.files[0]) {

      var reader = new FileReader();
      reader.readAsText(this.csvFile); // read file as data url
      // reader.readAsArrayBuffer(event.target.files[0]);  //read as Array buffer
      reader.onload = (event:any) => { // called once readAsDataURL is completed        
        // this.url = event.target.result;
        // console.log("url: " +this.url);    //base64

        // var img = new Image();
        // var imageSize:any;
        // var roundedImageSize:any;

        var csvData = event.target.result;   
        console.log("csv Data: " +csvData );
      }

      reader.onerror = error => console.log(error)    
    }

  } 

  addEmoji(event){

    // console.log(event.emoji.native);
    
    this.newBroadcast.message += event.emoji.native;
  }

  popUpEmojiBox(){

    this.popUpEmoji = !this.popUpEmoji;
  }

}
