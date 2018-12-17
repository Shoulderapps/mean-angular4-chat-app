import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';

import { csRegPath } from './../environments/environment';

import { AppComponent } from './app.component';
import { ChatService } from './chat.service';
import { ChatComponent } from './chat/chat.component';
import { AppheaderComponent } from './components/appheader/appheader.component';
import { AppfooterComponent } from './components/appfooter/appfooter.component';
import { AppmenuComponent } from './components/appmenu/appmenu.component';
import { AppsettingsComponent } from './components/appsettings/appsettings.component';
// import { ApploginComponent } from './components/applogin/applogin.component';
import { PagenotfoundComponent } from './pagenotfound/pagenotfound.component';
import { AdminComponent } from './admin/admin.component';
// import { OperatorComponent } from './operator/operator.component';
import { RequestComponent } from './request/request.component';
//import { ServiceComponent } from './service/service.component';
// import { AuthguardGuard } from './authguard.guard';
// import { AuthserviceService } from './authservice.service';
// import { HistoryComponent } from './history/history.component';
import { OpchatComponent } from './opchat/opchat.component';
import { OprequestComponent } from './oprequest/oprequest.component';

import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { AuthService } from './auth/auth.service';
import { AuthGuardService } from './auth/auth.guard.service';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { HistoryComponent } from './history/history.component';
// import { MultichatComponent } from './multichat/multichat.component';
// import { MultichatReqComponent } from './multichat-req/multichat-req.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { HistorySearchComponent } from './history-search/history-search.component';
import { UsersComponent } from './users/users.component';
import { UserDetailComponent } from './user-detail/user-detail.component';
// import { ExportHistoryComponent } from './export-history/export-history.component';
import { ReportSearchComponent } from './report-search/report-search.component';
import { OurServicesComponent } from './our-services/our-services.component';
import { CommandListComponent } from './command-list/command-list.component';
import { WhitelistComponent } from './whitelist/whitelist.component';
import { SettingComponent } from './setting/setting.component';
import { CampaignDetailComponent } from './campaign-detail/campaign-detail.component';
import { CampaignsComponent } from './campaigns/campaigns.component';
import { DisableIfUnauthorizedDirective } from './disable-if-unauthorized.directive';
import { HideIfUnauthorizedDirective } from './hide-if-unauthorized.directive';
import { BroadcastDetailComponent } from './broadcast-detail/broadcast-detail.component';
import { BroadcastComponent } from './broadcast/broadcast.component';


const appRoutes: Routes = [
    // { path: '', component: HomeComponent },
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { path: csRegPath , component: RegisterComponent },
  { path: 'api/forgotpwd', component: ForgotPasswordComponent },
  { path: 'api/resetpwd/:token', component: ResetPasswordComponent },
  { path: 'api/profile', component: ProfileComponent, canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']} },
  
  // { path: '', component: ApploginComponent, pathMatch: 'full'},
  
  { path: 'chat/request', component: RequestComponent, 
    children:[
      { path: 'chatbox/:id/:id2/:id3/:id4/:id5', component: ChatComponent, outlet:'chatOutlet',canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}}], canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},
  
  { path: 'chat/operator', component: OprequestComponent, 
    children:[
      { path: 'opchatbox/:id/:id2', component: OpchatComponent, outlet:'opchatOutlet',canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},
  ], canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},
 
  { path: 'chat/history', component: HistorySearchComponent, 
    children:[
      { path: 'historybox/:id', component: HistoryComponent, outlet:'historyOutlet',canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},
  ], canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},

  { path: 'chat/report', component: ReportSearchComponent, canActivate: [AuthGuardService], data: {role: ['BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},

  { path: 'chat/userSettingPage', component: UsersComponent, 
    children:[
      { path: 'userdetailbox/:id', component: UserDetailComponent, outlet:'userdetailOutlet',canActivate: [AuthGuardService], data: {role: ['BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']}},
  ], canActivate: [AuthGuardService], data: {role: ['BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']} }, 
  
  { path: 'chat/whatsappwhitelist', component: WhitelistComponent, canActivate: [AuthGuardService], data: {role: ['PREMIUM', 'PREMIUM+', 'ADMIN']}},  
  
  { path: 'chat/broadcast', component: BroadcastComponent, 
    children:[
      { path: 'broadcastdetailbox/:id', component: BroadcastDetailComponent, outlet:'broadcastdetailOutlet',canActivate: [AuthGuardService], data: {role: ['PREMIUM+', 'ADMIN']}},
  ], canActivate: [AuthGuardService], data: {role: ['PREMIUM+', 'ADMIN']} }, 

  { path: 'chat/campaign', component: CampaignsComponent, canActivate: [AuthGuardService], data: {role: ['PREMIUM+', 'ADMIN']} },
  
  { path: 'chat/settings', component: SettingComponent, canActivate: [AuthGuardService], data: {role: ['ADMIN']} }, // { path: 'opchat', component: OpchatComponent, canActivate: [AuthguardGuard] },
  
  { path: 'chat/ourservices', component: OurServicesComponent, canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']} },
  
  { path: 'chat/commandlist', component: CommandListComponent, canActivate: [AuthGuardService], data: {role: ['BASIC', 'BASIC+', 'PREMIUM', 'PREMIUM+', 'ADMIN']} },    
  // { path: 'admin', component: AdminComponent , canActivate: [AuthguardGuard]},
  // { path: 'oldoperator', component: OperatorComponent, canActivate: [AuthguardGuard] },
  { path: '**', component: PagenotfoundComponent}
  // { path: '', redirectTo: '/login', pathMatch: 'full', canActivate: [AuthguardGuard] },
  // { path: 'login', component: ApploginComponent},
  // { path: 'service', component: ServiceComponent, children: [
  //     { path: 'request', component: RequestComponent, outlet:'requestOutlet' },
  //     { path: 'chat', component: ChatComponent, outlet:'chatOutlet'},
  // ]},
  // { path: 'request', component: RequestComponent, children:[
  //     { path: 'chatbox/:id/:id2', component: ChatComponent, outlet:'chatOutlet'},
  // ]},
  // { path: 'admin', component: AdminComponent },
  // { path: 'operator', component: OperatorComponent },
  // { path: '**', component: PagenotfoundComponent}
];
 
@NgModule({
  imports: [
      
    RouterModule.forRoot(
        appRoutes,
      //{ useHash: false }
      { enableTracing: false } // <-- debugging purposes only
    )
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {}