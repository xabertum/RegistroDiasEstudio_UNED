package es.uned.estudio.seed;

import es.uned.estudio.seed.TemarioLoader.AsignaturaJson;
import es.uned.estudio.seed.TemarioLoader.NodoJson;
import es.uned.estudio.service.EstudioService;
import es.uned.estudio.web.Dtos.AsignaturaDetalle;
import es.uned.estudio.web.Dtos.TemaNodo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:loader;DB_CLOSE_DELAY=-1")
@Transactional
class TemarioLoaderTest {

    @Autowired
    TemarioLoader loader;

    @Autowired
    EstudioService service;

    @Autowired
    JsonMapper jsonMapper;

    @Test
    void sinCambiosEnElJsonNoSeTocaElTemario() throws Exception {
        Long grupos = idDe("62013065");
        TemaNodo tema1 = service.detalle(grupos).temario().get(0);
        service.marcarTema(tema1.id(), true);
        service.cambiarSemana(grupos, 2);

        loader.sincronizar(leerJson());

        AsignaturaDetalle tras = service.detalle(grupos);
        assertThat(tras.temario().get(0).id()).isEqualTo(tema1.id());
        assertThat(tras.temario().get(0).estudiado()).isTrue();
        assertThat(tras.resumen().semanaElegida()).isEqualTo(2);
    }

    @Test
    void siCambiaElTemarioSeConservaLoEstudiadoEnLosApartadosConElMismoTitulo() throws Exception {
        Long grupos = idDe("62013065");
        List<TemaNodo> antes = service.detalle(grupos).temario();
        service.marcarTema(antes.get(1).id(), true);
        service.marcarTema(antes.get(2).id(), true);
        service.cambiarSemana(grupos, 2);

        // Se añade un apartado nuevo al Tema 3
        List<AsignaturaJson> datos = new ArrayList<>(leerJson());
        AsignaturaJson a = datos.stream().filter(d -> d.codigo().equals("62013065")).findFirst().orElseThrow();
        List<NodoJson> temas = new ArrayList<>(a.temas());
        NodoJson tema3 = temas.get(2);
        List<NodoJson> hijos = new ArrayList<>(tema3.hijos());
        hijos.add(new NodoJson("Apartado nuevo", null));
        temas.set(2, new NodoJson(tema3.titulo(), hijos));
        datos.set(datos.indexOf(a), new AsignaturaJson(a.codigo(), a.nombre(), a.libro(),
                a.examenSemana1(), a.examenSemana2(), temas));

        loader.sincronizar(datos);

        AsignaturaDetalle tras = service.detalle(grupos);
        TemaNodo tema2Tras = tras.temario().get(1);
        TemaNodo tema3Tras = tras.temario().get(2);
        assertThat(tema2Tras.estudiado()).isTrue();
        assertThat(tema2Tras.fechaEstudiado()).isNotNull();
        assertThat(tema3Tras.estudiado()).isFalse();
        assertThat(tema3Tras.apartadosEstudiados()).isEqualTo(tema3Tras.totalApartados() - 1);
        assertThat(tema3Tras.hijos().getLast().titulo()).isEqualTo("Apartado nuevo");
        assertThat(tras.temario().get(0).estudiado()).isFalse();
        assertThat(tras.resumen().semanaElegida()).isEqualTo(2);
    }

    private Long idDe(String codigo) {
        return service.listar().stream().filter(a -> a.codigo().equals(codigo)).findFirst().orElseThrow().id();
    }

    private List<AsignaturaJson> leerJson() throws Exception {
        try (InputStream in = new ClassPathResource("temario.json").getInputStream()) {
            return jsonMapper.readValue(in, new TypeReference<>() {
            });
        }
    }
}
