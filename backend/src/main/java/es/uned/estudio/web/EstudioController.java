package es.uned.estudio.web;

import es.uned.estudio.service.EstudioService;
import es.uned.estudio.web.Dtos.AsignaturaDetalle;
import es.uned.estudio.web.Dtos.AsignaturaResumen;
import es.uned.estudio.web.Dtos.CambioEstudiado;
import es.uned.estudio.web.Dtos.CambioSemana;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class EstudioController {

    private final EstudioService service;

    public EstudioController(EstudioService service) {
        this.service = service;
    }

    @GetMapping("/asignaturas")
    public List<AsignaturaResumen> asignaturas() {
        return service.listar();
    }

    @GetMapping("/asignaturas/{id}")
    public AsignaturaDetalle asignatura(@PathVariable Long id) {
        return service.detalle(id);
    }

    @PatchMapping("/asignaturas/{id}/semana")
    public AsignaturaResumen cambiarSemana(@PathVariable Long id, @Valid @RequestBody CambioSemana cambio) {
        return service.cambiarSemana(id, cambio.semana());
    }

    @PatchMapping("/temas/{id}")
    public AsignaturaDetalle marcarTema(@PathVariable Long id, @Valid @RequestBody CambioEstudiado cambio) {
        return service.marcarTema(id, cambio.estudiado());
    }
}
