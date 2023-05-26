import { Component, OnInit } from '@angular/core';
import { Permiso } from '../servicios/permiso.service';
import { UsuarioActualService } from '../servicios/usuario-actual.service';
import {Router} from "@angular/router";
import { Usuario, UsuarioService,Amistad,EstadosAmistades } from '../servicios/usuario.service';
import { TokensService } from '../servicios/tokens.service';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.scss']
})
export class PanelComponent implements OnInit {

	LARGO_MINIMO_CONTRASENIA=8;
	LARGO_MINIMO_NOMBRE_USUARIO=2;
	LARGO_MINIMO_NOMBRE_COMPLETO=5;
	CANTIDAD_MAXIMA_TOKENS_GENERADOS=100000;

  usuarioActual:Usuario={} as Usuario;
  
  // TODO DRY
  // TODO sort
  get amigosEntrantes() {
    return (this.usuarioActual?.amigos??[]).filter(ami=> ami.amistades.estado=='esperando' && ami.amistades.amigoID==this.usuarioActual.ID);
  }
  get amigosSalientes() {
    return (this.usuarioActual?.amigos??[]).filter(ami=> ami.amistades.estado=='esperando' && ami.amistades.amigoID!=this.usuarioActual.ID);
  }
  get amigosReales() {
    return (this.usuarioActual?.amigos??[]).filter(ami=> ami.amistades.estado!='esperando');
  }

  puedeGenerarTokens:boolean = false;
  tokensCirculando:number = 0;
  
  console=console;

  busquedaID=0;
  usuariosEncontrados:Usuario[] = [];
  puedeMostrarVacio=false;
  get mostrarVacio(){
    return this.puedeMostrarVacio && this.usuariosEncontrados.length==0;
  }

  constructor(
    private usuarioActualService:UsuarioActualService,
    private usuarioService: UsuarioService,
    private tokensService: TokensService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.usuarioActualService.getUsuarioActual()
      .subscribe({
        next:(usuario:any) => {
          this.usuarioActual= usuario;
          this.console.log(this.usuarioActual.amigos);

          /* * Cada Usuario.amigos tiene un .amistad con los detalles de la invitación; estado y quien la mando */

          /* TODO Que solo se puedan enviar tokens a amigos */

          this.puedeGenerarTokens=this.usuarioActual.permisos?.some((per:Permiso)=>per.ID==1) || false;
          if(this.puedeGenerarTokens)
            this.tokensService
              .obtenerCantidadCirculando()
              .subscribe((result: any)=>{
                this.tokensCirculando=result;
              });
        }
        ,error:error=>{
          this.console.log(error);
          this.router.navigate(['/'])
        }
      });
  }

  busqueda(e:Event):void{

    /* Estados de la búsqueda:
    Esperando entrada del usuario (inicial)
      ❌ Hoy es this.mostrarVacío=false y this.usuariosEncontrados vacío, y es literalmente nada. Podría ser una llamada a la acción.
    Buscando (cargando)
      ❌ Falta. Hoy es igual al inicial
    Repuesta positiva, listado de gente
      ✔ Caracterizado por usuariosEncontrados con gente
    Respuesta negativa, vacío, mensaje
      ✔ this.mostrarVacío=false y this.usuariosEncontrados vacío
     */

    let busquedaID=++this.busquedaID;

    let consulta=(e.target as HTMLInputElement).value.trim();

      this.puedeMostrarVacio=false;

    if(consulta.length>3)
      this.usuarioService
        .buscarDifusamentePorNombre(consulta)
        .subscribe((result: any)=>{
          if(this.busquedaID==busquedaID){
            this.usuariosEncontrados=result;
            if(result.length==0){
              this.puedeMostrarVacio=true;
            }
          }
        });
    else{
      this.usuariosEncontrados=[];
    }
  }

  invitar(e:Event):void {
    e.preventDefault();

    let usuarioID=(e.target as any)['usuarioID'].value;

    (document.getElementById('resultados') as HTMLFieldSetElement).disabled=true;
    this.usuarioService
      .invitar(usuarioID)
      .subscribe({
        next:(result: any)=>{
          let indice:number =this.usuariosEncontrados.findIndex(usu=>usu.ID==usuarioID);
          let nuevoAmigo:Usuario= this.usuariosEncontrados[indice] as Usuario;
          nuevoAmigo.amistades=({estado:'esperando',amigoID:usuarioID}) as Amistad;
          this.usuarioActual.amigos?.push(nuevoAmigo as Usuario);
          
          this.usuariosEncontrados.splice(indice, 1);
        }
        ,error:error=>{
          this.console.log(error);
        }
        ,complete:()=>{
          (document.getElementById('resultados') as HTMLFieldSetElement).disabled=false;
        }
      })

  }

  cancelar(e:Event):void{
    e.preventDefault();

    let usuarioID=(e.target as any)['usuarioID'].value;

    this.usuarioService
      .eliminarInvitacion(usuarioID,true)
      .subscribe({
        next:(result: any)=>{
          let indice:number =(this.usuarioActual.amigos||[]).findIndex(usu=>usu.ID==usuarioID);
          this.usuarioActual.amigos?.splice(indice, 1);
        }
        ,error:error=>{
          this.console.log(error);
        }
      })
  }

  responder(e:Event):void{
    e.preventDefault();

    let usuarioID=(e.target as any)['usuarioID'].value;
    let botonApretado=(e.target as any)['accion'];

    if(+botonApretado.value)
      this.usuarioService
        .aceptarInvitacion(usuarioID)
        .subscribe({
          next:(amigo: any)=>{
            // this.console.log(this.usuarioActual.amigos);
            this.console.log(amigo);
            // this.usuarioActual.amigos
            ((this.usuarioActual.amigos||[]).find(ami=>ami.ID==usuarioID) as Usuario).amistades.estado=EstadosAmistades.Amigos/* 'amigos' */; //delet, Ig
            return;

          }
          ,error:error=>{
            this.console.log(error);
          }
        });
    else this.usuarioService
      .eliminarInvitacion(usuarioID,false)
      .subscribe({
        next:(result: any)=>{
          let indice:number =(this.usuarioActual.amigos||[]).findIndex(usu=>usu.ID==usuarioID);
          this.usuarioActual.amigos?.splice(indice, 1);
        }
        ,error:error=>{
          this.console.log(error);
        }
      });
  }

  eliminar(e:Event):void{
    e.preventDefault();

    // TODO Avisar que es no se puede deshacer
    let usuarioID=(e.target as any)['usuarioID'].value;
    this.usuarioService
      .eliminarAmigo(usuarioID)
      .subscribe({
        next:(result: any)=>{
          let indice:number =(this.usuarioActual.amigos||[]).findIndex(usu=>usu.ID==usuarioID);
          this.usuarioActual.amigos?.splice(indice, 1);
        }
        ,error:error=>{
          this.console.log(error);
        }
      });
  }

  generar(e:Event):void{
    
  }

  asignarNombreABoton(e:Event):void{
    (e.target as HTMLInputElement).name='accion';
  }
}
