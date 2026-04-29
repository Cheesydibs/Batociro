package main

import (
  "ftm"  //is nodig voor bepaalde functies//
  "net/http"   //zorgt ervoor dat dingen zoals cookies en redirects goed worden gebruikt, denk ik//
  "time"  //is voor tijd, duh//
)

type login struct{
  HashedPassword string
  SessionToken string
  CSRFToken string
}

//usernames worden samen met gegevens in een map bewaard//
var users = map[string]login{}

//alle functies (voor nu, misschien later meer)//
func main() {
  http.HandleFunc("/register", register)
  http.HandleFunc("/login", login)
  http.HandleFunc("/logout", logout)
  http.HandleFunc("/protected", protected)
  http.HandleFunc(":8080", nil)
}

func register(w http.ResponseWriter, r http.Request){}

func login(w http.ResponseWriter, r http.Request){}

func logout(w http.ResponseWriter, r http.Request){}

func protected(w http.ResponseWriter, r http.Request){}